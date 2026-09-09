import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuid } from "uuid";
import { startOfWeek, endOfWeek, subDays, format as formatDateLabel } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import {
  workoutRepository,
  strengthWorkoutRepository,
  volleyballSessionRepository,
  getWorkoutsInRange,
  getUserProfileOrDefault,
} from "../../storage/repositories";
import type { StrengthExercise, VolleyballSession, Workout } from "../../storage/schemas/workout";
import { getWeeklyTrainingLoad, detectPrs, type PrCandidate } from "../../app/services/trainingService";
import { estimateVolleyballCalories } from "../../domain/training/volleyballModel";
import { importStrongCsv, type StrongImportSummary } from "../../app/services/strongImportService";
import type { ConfidenceTier } from "../../domain/models/common";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const labelClass = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";
const primaryButtonClass =
  "rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50";
const secondaryButtonClass =
  "rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300";
const removeLinkClass = "text-xs font-medium text-accent underline";

const GOAL_EXERCISES_STORAGE_KEY = "trainingGoalExercises";

function parseNullableNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

interface SetRow {
  key: string;
  weightLb: string;
  reps: string;
  rir: string;
  rpe: string;
}
interface ExerciseBlock {
  key: string;
  name: string;
  sets: SetRow[];
}

function makeSetRow(): SetRow {
  return { key: uuid(), weightLb: "", reps: "", rir: "", rpe: "" };
}
function makeExerciseBlock(): ExerciseBlock {
  return { key: uuid(), name: "", sets: [makeSetRow()] };
}

function loadGoalExercises(): string[] {
  try {
    const raw = window.localStorage.getItem(GOAL_EXERCISES_STORAGE_KEY);
    if (!raw) return ["", "", ""];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const arr = parsed.slice(0, 3).map((v) => (typeof v === "string" ? v : ""));
      while (arr.length < 3) arr.push("");
      return arr;
    }
  } catch {
    // corrupt/unavailable storage — fall back to empty goals rather than crash the screen
  }
  return ["", "", ""];
}

function saveGoalExercises(goals: string[]) {
  try {
    window.localStorage.setItem(GOAL_EXERCISES_STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // storage unavailable (private mode / quota) — goal inputs still work in-memory
  }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that file."));
    reader.readAsText(file);
  });
}

const WORKOUT_TYPE_LABELS: Record<Workout["workoutType"], string> = {
  strength: "Strength",
  volleyball: "Volleyball",
  run: "Run",
  other: "Other",
};

export function TrainingScreen() {
  // ---- Weekly training load ----
  const weekRange = useMemo(() => {
    const now = new Date();
    return {
      startIso: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
      endIso: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
    };
  }, []);
  const weeklyLoad = useLiveQuery(
    () => getWeeklyTrainingLoad(weekRange.startIso, weekRange.endIso),
    [weekRange.startIso, weekRange.endIso],
  );
  const loadChartData = weeklyLoad
    ? [
        { name: "Upper", value: Math.round(weeklyLoad.upperBodyLoad * 10) / 10 },
        { name: "Lower", value: Math.round(weeklyLoad.lowerBodyLoad * 10) / 10 },
        { name: "Impact", value: Math.round(weeklyLoad.highImpactLoad * 10) / 10 },
      ]
    : [];

  // ---- Strength logging form ----
  const [strengthDuration, setStrengthDuration] = useState("45");
  const [exercises, setExercises] = useState<ExerciseBlock[]>([makeExerciseBlock()]);
  const [strengthMessage, setStrengthMessage] = useState<string | null>(null);

  function addExercise() {
    setExercises((prev) => [...prev, makeExerciseBlock()]);
  }
  function removeExercise(key: string) {
    setExercises((prev) => (prev.length > 1 ? prev.filter((e) => e.key !== key) : prev));
  }
  function updateExerciseName(key: string, name: string) {
    setExercises((prev) => prev.map((e) => (e.key === key ? { ...e, name } : e)));
  }
  function addSet(exerciseKey: string) {
    setExercises((prev) =>
      prev.map((e) => (e.key === exerciseKey ? { ...e, sets: [...e.sets, makeSetRow()] } : e)),
    );
  }
  function removeSet(exerciseKey: string, setKey: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.key === exerciseKey && e.sets.length > 1
          ? { ...e, sets: e.sets.filter((s) => s.key !== setKey) }
          : e,
      ),
    );
  }
  function updateSetField(exerciseKey: string, setKey: string, field: keyof Omit<SetRow, "key">, value: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.key === exerciseKey
          ? { ...e, sets: e.sets.map((s) => (s.key === setKey ? { ...s, [field]: value } : s)) }
          : e,
      ),
    );
  }

  async function handleSaveStrength() {
    const strengthExercises: StrengthExercise[] = exercises
      .filter((e) => e.name.trim() !== "")
      .map((e, exIndex) => ({
        id: uuid(),
        name: e.name.trim(),
        orderIndex: exIndex,
        sets: e.sets.map((s, setIndex) => ({
          id: uuid(),
          orderIndex: setIndex,
          weightLb: parseNullableNumber(s.weightLb),
          reps: parseNullableNumber(s.reps),
          rir: parseNullableNumber(s.rir),
          rpe: parseNullableNumber(s.rpe),
          restSeconds: null,
          isPr: false,
        })),
      }));

    if (strengthExercises.length === 0) {
      setStrengthMessage("Add at least one exercise name before saving.");
      return;
    }

    const workoutId = uuid();
    const workout: Workout = {
      id: workoutId,
      source: "manual",
      sourceWorkoutId: null,
      workoutType: "strength",
      startTime: new Date().toISOString(),
      endTime: null,
      durationMinutes: parseNullableNumber(strengthDuration) ?? 0,
      activeCaloriesKcal: null,
      totalCaloriesKcal: null,
      averageHeartRate: null,
      maxHeartRate: null,
      hrZones: null,
      perceivedExertion: null,
      notes: null,
    };

    await workoutRepository.put(workout);
    await strengthWorkoutRepository.put({ workoutId, exercises: strengthExercises });

    setExercises([makeExerciseBlock()]);
    setStrengthDuration("45");
    setStrengthMessage("Workout saved.");
  }

  // ---- PR detection ----
  const prCandidates = useLiveQuery(async () => {
    const start = subDays(new Date(), 365).toISOString();
    const end = new Date().toISOString();
    const workouts = await getWorkoutsInRange(start, end);
    const strengthWorkouts = workouts.filter((w) => w.workoutType === "strength");
    return detectPrs(strengthWorkouts);
  }, []);

  const newPrsGrouped = useMemo(() => {
    const newPrs = (prCandidates ?? [])
      .filter((p) => p.isNewPr)
      .sort((a, b) => b.date.localeCompare(a.date));
    const map = new Map<string, PrCandidate[]>();
    for (const pr of newPrs) {
      const arr = map.get(pr.exerciseName) ?? [];
      arr.push(pr);
      map.set(pr.exerciseName, arr);
    }
    return Array.from(map.entries());
  }, [prCandidates]);

  // ---- Goal exercises ----
  const [goalExercises, setGoalExercises] = useState<string[]>(() => loadGoalExercises());
  function updateGoalExercise(index: number, value: string) {
    setGoalExercises((prev) => {
      const next = [...prev];
      next[index] = value;
      saveGoalExercises(next);
      return next;
    });
  }
  function bestForExercise(name: string): PrCandidate | null {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return null;
    const matches = (prCandidates ?? []).filter((p) => p.exerciseName.trim().toLowerCase() === normalized);
    if (matches.length === 0) return null;
    return matches.reduce((best, p) => (p.weightLb > best.weightLb ? p : best));
  }

  // ---- Volleyball logging form ----
  const profile = useLiveQuery(() => getUserProfileOrDefault(), []);
  const [vbDefaultsInitialized, setVbDefaultsInitialized] = useState(false);
  const [vbDuration, setVbDuration] = useState("60");
  const [vbAvgHr, setVbAvgHr] = useState("");
  const [vbRestingHr, setVbRestingHr] = useState("");
  const [vbMaxHr, setVbMaxHr] = useState("");
  const [vbFormat, setVbFormat] = useState<VolleyballSession["format"]>("6v6");
  const [vbJumpVolume, setVbJumpVolume] = useState<"" | NonNullable<VolleyballSession["jumpVolume"]>>("");
  const [vbRole, setVbRole] = useState("");
  const [vbWarmup, setVbWarmup] = useState("");
  const [vbAppleCalories, setVbAppleCalories] = useState("");
  const [vbResult, setVbResult] = useState<{
    estimateKcal: number;
    rangeLowKcal: number;
    rangeHighKcal: number;
    confidence: ConfidenceTier;
    appleActiveCaloriesKcal: number | null;
  } | null>(null);

  useEffect(() => {
    if (profile && !vbDefaultsInitialized) {
      if (profile.restingHeartRate != null) setVbRestingHr(String(profile.restingHeartRate));
      if (profile.observedMaxHeartRate != null) setVbMaxHr(String(profile.observedMaxHeartRate));
      setVbDefaultsInitialized(true);
    }
  }, [profile, vbDefaultsInitialized]);

  async function handleSaveVolleyball() {
    const durationMinutes = parseNullableNumber(vbDuration) ?? 0;
    const averageHeartRate = parseNullableNumber(vbAvgHr);
    const restingHeartRate = parseNullableNumber(vbRestingHr);
    const observedMaxHeartRate = parseNullableNumber(vbMaxHr);
    const appleActiveCaloriesKcal = parseNullableNumber(vbAppleCalories);

    const allWorkouts = await getWorkoutsInRange(new Date(0).toISOString(), new Date().toISOString());
    const priorSessionsCount = allWorkouts.filter((w) => w.workoutType === "volleyball").length;

    const estimate = estimateVolleyballCalories({
      durationMinutes,
      averageHeartRate,
      restingHeartRate,
      observedMaxHeartRate,
      priorSessionsCount,
    });

    const workoutId = uuid();
    const workout: Workout = {
      id: workoutId,
      source: "manual",
      sourceWorkoutId: null,
      workoutType: "volleyball",
      startTime: new Date().toISOString(),
      endTime: null,
      durationMinutes,
      activeCaloriesKcal: Math.round(estimate.estimateKcal),
      totalCaloriesKcal: null,
      averageHeartRate,
      maxHeartRate: null,
      hrZones: null,
      perceivedExertion: null,
      notes: null,
    };

    const session: VolleyballSession = {
      workoutId,
      format: vbFormat,
      activePlayMinutes: null,
      passiveRestMinutes: null,
      warmupActivity: vbWarmup.trim() === "" ? null : vbWarmup.trim(),
      jumpVolume: vbJumpVolume === "" ? null : vbJumpVolume,
      role: vbRole.trim() === "" ? null : vbRole.trim(),
      appleActiveCaloriesKcal,
      modelEstimate: {
        name: "volleyballActiveCalories",
        value: estimate.estimateKcal,
        rangeLow: estimate.rangeLowKcal,
        rangeHigh: estimate.rangeHighKcal,
        confidence: estimate.confidence,
        sources: ["heartRate", "duration"],
        algorithmVersion: "volleyball-model.v1",
        computedAt: new Date().toISOString(),
      },
      notes: null,
    };

    await workoutRepository.put(workout);
    await volleyballSessionRepository.put(session);

    setVbResult({
      estimateKcal: estimate.estimateKcal,
      rangeLowKcal: estimate.rangeLowKcal,
      rangeHighKcal: estimate.rangeHighKcal,
      confidence: estimate.confidence,
      appleActiveCaloriesKcal,
    });
    setVbAvgHr("");
    setVbAppleCalories("");
  }

  // ---- Strong CSV importer ----
  const [importSummary, setImportSummary] = useState<StrongImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    setImportSummary(null);
    try {
      const text = await readFileAsText(file);
      const summary = await importStrongCsv(text);
      setImportSummary(summary);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  // ---- Recent workouts (14 days) ----
  const recentWorkouts = useLiveQuery(() => {
    const end = new Date();
    const start = subDays(end, 14);
    return getWorkoutsInRange(start.toISOString(), end.toISOString());
  }, []);

  const recentByType = useMemo(() => {
    const map = new Map<Workout["workoutType"], Workout[]>();
    for (const w of recentWorkouts ?? []) {
      const arr = map.get(w.workoutType) ?? [];
      arr.push(w);
      map.set(w.workoutType, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => b.startTime.localeCompare(a.startTime));
    return Array.from(map.entries());
  }, [recentWorkouts]);

  return (
    <div className="space-y-6 pb-6">
      <PageHeader title="Training" subtitle="Strength, volleyball, and this week's load" />

      {/* Weekly training load */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">This week's load</h2>
        {weeklyLoad ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={loadChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} width={30} />
                <Tooltip />
                <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Loading...</p>
        )}
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Sets for strength, minutes-weighted for volleyball. Monday–Sunday, this week.
        </p>
      </Card>

      {/* Strength logging form */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Log strength workout</h2>
        <div className="mb-3">
          <label className={labelClass}>Session duration (minutes)</label>
          <input
            type="number"
            className={inputClass}
            value={strengthDuration}
            onChange={(e) => setStrengthDuration(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {exercises.map((exercise, exIndex) => (
            <div key={exercise.key} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Exercise ${exIndex + 1} name`}
                  className={inputClass}
                  value={exercise.name}
                  onChange={(e) => updateExerciseName(exercise.key, e.target.value)}
                />
                {exercises.length > 1 && (
                  <button type="button" className={removeLinkClass} onClick={() => removeExercise(exercise.key)}>
                    Remove
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {exercise.sets.map((set, setIndex) => (
                  <div key={set.key} className="grid grid-cols-5 items-center gap-1">
                    <span className="text-xs text-slate-400">#{setIndex + 1}</span>
                    <input
                      type="number"
                      placeholder="lb"
                      className={inputClass}
                      value={set.weightLb}
                      onChange={(e) => updateSetField(exercise.key, set.key, "weightLb", e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="reps"
                      className={inputClass}
                      value={set.reps}
                      onChange={(e) => updateSetField(exercise.key, set.key, "reps", e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="RIR"
                      className={inputClass}
                      value={set.rir}
                      onChange={(e) => updateSetField(exercise.key, set.key, "rir", e.target.value)}
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="RPE"
                        className={inputClass}
                        value={set.rpe}
                        onChange={(e) => updateSetField(exercise.key, set.key, "rpe", e.target.value)}
                      />
                      {exercise.sets.length > 1 && (
                        <button
                          type="button"
                          className="text-xs text-slate-400"
                          onClick={() => removeSet(exercise.key, set.key)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-accent underline"
                onClick={() => addSet(exercise.key)}
              >
                + Add set
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button type="button" className={secondaryButtonClass} onClick={addExercise}>
            + Add exercise
          </button>
          <button type="button" className={primaryButtonClass} onClick={() => void handleSaveStrength()}>
            Save workout
          </button>
        </div>
        {strengthMessage && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{strengthMessage}</p>}
      </Card>

      {/* PR list */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Recent PRs</h2>
        {newPrsGrouped.length === 0 ? (
          <p className="text-sm text-slate-400">No new PRs logged in the last year yet.</p>
        ) : (
          <div className="space-y-3">
            {newPrsGrouped.map(([exerciseName, prs]) => (
              <div key={exerciseName}>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">{exerciseName}</h3>
                <ul className="mt-1 space-y-0.5">
                  {prs.map((pr, i) => (
                    <li key={`${exerciseName}-${i}`} className="text-sm text-slate-700 dark:text-slate-200">
                      {pr.weightLb} lb × {pr.reps} (new PR) — {formatDateLabel(new Date(pr.date), "MMM d, yyyy")}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Goal exercises */}
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Goal exercises</h2>
        <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
          Track up to 3 lifts you care about (e.g. bench press, pull-up, squat, vertical jump proxy).
        </p>
        <div className="space-y-3">
          {goalExercises.map((goal, i) => {
            const best = bestForExercise(goal);
            return (
              <div key={i}>
                <input
                  type="text"
                  placeholder={`Goal exercise ${i + 1}`}
                  className={inputClass}
                  value={goal}
                  onChange={(e) => updateGoalExercise(i, e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {goal.trim() === ""
                    ? "Enter an exercise name to track it here."
                    : best
                      ? `Current best: ${best.weightLb} lb × ${best.reps} (${formatDateLabel(new Date(best.date), "MMM d, yyyy")})`
                      : "No logged sets found for this exercise name yet."}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Volleyball logging form */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Log volleyball session</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Duration (minutes)</label>
            <input type="number" className={inputClass} value={vbDuration} onChange={(e) => setVbDuration(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Average heart rate</label>
            <input type="number" className={inputClass} value={vbAvgHr} onChange={(e) => setVbAvgHr(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Resting heart rate</label>
            <input type="number" className={inputClass} value={vbRestingHr} onChange={(e) => setVbRestingHr(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Observed max heart rate</label>
            <input type="number" className={inputClass} value={vbMaxHr} onChange={(e) => setVbMaxHr(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Format</label>
            <select
              className={inputClass}
              value={vbFormat}
              onChange={(e) => setVbFormat(e.target.value as VolleyballSession["format"])}
            >
              <option value="6v6">6v6</option>
              <option value="6v4">6v4</option>
              <option value="beach">Beach</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Jump volume</label>
            <select
              className={inputClass}
              value={vbJumpVolume}
              onChange={(e) => setVbJumpVolume(e.target.value as typeof vbJumpVolume)}
            >
              <option value="">Unspecified</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <input type="text" className={inputClass} value={vbRole} onChange={(e) => setVbRole(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Warmup activity</label>
            <input type="text" className={inputClass} value={vbWarmup} onChange={(e) => setVbWarmup(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Apple Watch active calories (optional, for comparison)</label>
            <input
              type="number"
              className={inputClass}
              value={vbAppleCalories}
              onChange={(e) => setVbAppleCalories(e.target.value)}
            />
          </div>
        </div>

        <button type="button" className={`${primaryButtonClass} mt-3`} onClick={() => void handleSaveVolleyball()}>
          Save session
        </button>

        {vbResult && (
          <div className="mt-4 rounded-lg bg-accent-muted/20 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Apple vs. this app's model</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Apple Watch</p>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {vbResult.appleActiveCaloriesKcal != null ? `${vbResult.appleActiveCaloriesKcal} kcal` : "Not entered"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">This app's model</p>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {Math.round(vbResult.estimateKcal)} kcal ({Math.round(vbResult.rangeLowKcal)}–
                  {Math.round(vbResult.rangeHighKcal)})
                </p>
                <div className="mt-1">
                  <ConfidenceBadge tier={vbResult.confidence} />
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Strong CSV import */}
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Import from Strong</h2>
        <input type="file" accept=".csv" onChange={(e) => void handleImportFile(e)} className="text-sm" />
        {importSummary && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Added {importSummary.workoutsAdded}, skipped {importSummary.workoutsSkippedAsDuplicate} duplicate(s).
            {importSummary.warnings.length > 0 && ` Warnings: ${importSummary.warnings.join("; ")}`}
          </p>
        )}
        {importError && <p className="mt-2 text-xs text-red-500">{importError}</p>}
      </Card>

      {/* Recent workouts */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Recent workouts (14 days)</h2>
        {recentByType.length === 0 ? (
          <p className="text-sm text-slate-400">No workouts logged in the last 14 days.</p>
        ) : (
          <div className="space-y-3">
            {recentByType.map(([type, workouts]) => (
              <div key={type}>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {WORKOUT_TYPE_LABELS[type]}
                </h3>
                <ul className="mt-1 space-y-0.5">
                  {workouts.map((w) => (
                    <li key={w.id} className="text-sm text-slate-700 dark:text-slate-200">
                      {formatDateLabel(new Date(w.startTime), "MMM d, yyyy")} — {w.durationMinutes} min
                      {w.activeCaloriesKcal != null ? `, ${w.activeCaloriesKcal} kcal` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
