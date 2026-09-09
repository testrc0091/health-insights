import { useEffect, useState, type ChangeEvent } from "react";

import { useAppContext } from "../../app/AppProviders";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { toIsoDate } from "../../domain/dateUtils";
import type { UserProfile } from "../../storage/schemas/userProfile";
import type { ActivityType, DayOfWeek, DayOfWeekPlan } from "../../domain/models/common";
import { importAppleHealthExport, type HealthImportSummary } from "../../app/services/healthImportService";
import { importStrongCsv, type StrongImportSummary } from "../../app/services/strongImportService";
import { exportBackup, importBackup } from "../../app/services/backupService";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const labelClass = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

const DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL: Record<DayOfWeek, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
const ACTIVITY_OPTIONS: ActivityType[] = ["lifting", "volleyball", "recovery", "rest", "other"];

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/** Profile/targets editor, data-import tools (Apple Health, Strong CSV), and JSON
 * backup/restore — everything that isn't a day-to-day log lives here. */
export function SettingsScreen() {
  const { userProfile, saveUserProfile, isReady } = useAppContext();

  const [form, setForm] = useState<UserProfile>(userProfile);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Local form state is seeded from the live profile exactly once, the first time
  // it's known to be the real persisted value (not the pre-load default) — after
  // that, edits in this form are the source of truth until Save, so a later
  // re-render of `userProfile` (e.g. triggered by our own save) never clobbers
  // in-progress edits.
  useEffect(() => {
    if (isReady && !hasLoadedProfile) {
      setForm(userProfile);
      setHasLoadedProfile(true);
    }
  }, [isReady, hasLoadedProfile, userProfile]);

  const [healthSummary, setHealthSummary] = useState<HealthImportSummary | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);

  const [strongSummary, setStrongSummary] = useState<StrongImportSummary | null>(null);
  const [strongError, setStrongError] = useState<string | null>(null);
  const [strongBusy, setStrongBusy] = useState(false);

  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  function scheduleFor(day: DayOfWeek): DayOfWeekPlan {
    return form.trainingSchedule.find((p) => p.day === day) ?? { day, activityType: "rest", calorieTarget: null };
  }

  function updateSchedule(day: DayOfWeek, patch: Partial<Pick<DayOfWeekPlan, "activityType" | "calorieTarget">>) {
    setForm((prev) => {
      const exists = prev.trainingSchedule.some((p) => p.day === day);
      const nextSchedule = exists
        ? prev.trainingSchedule.map((p) => (p.day === day ? { ...p, ...patch } : p))
        : [...prev.trainingSchedule, { day, activityType: "rest" as ActivityType, calorieTarget: null, ...patch }];
      return { ...prev, trainingSchedule: nextSchedule };
    });
  }

  async function handleSave() {
    setSaveState("saving");
    setSaveError(null);
    try {
      await saveUserProfile(form);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Could not save profile.");
    }
  }

  async function handleAppleHealthFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHealthBusy(true);
    setHealthError(null);
    setHealthSummary(null);
    try {
      const text = await readFileAsText(file);
      const summary = await importAppleHealthExport(text);
      setHealthSummary(summary);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setHealthBusy(false);
      e.target.value = "";
    }
  }

  async function handleStrongFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStrongBusy(true);
    setStrongError(null);
    setStrongSummary(null);
    try {
      const text = await readFileAsText(file);
      const summary = await importStrongCsv(text);
      setStrongSummary(summary);
    } catch (err) {
      setStrongError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setStrongBusy(false);
      e.target.value = "";
    }
  }

  async function handleExportBackup() {
    setBackupBusy(true);
    setBackupMessage(null);
    try {
      const payload = await exportBackup();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `health-insights-backup-${toIsoDate(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupMessage("Backup downloaded.");
    } catch (err) {
      setBackupMessage(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleImportBackupFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupBusy(true);
    setBackupMessage(null);
    try {
      const text = await readFileAsText(file);
      const payload = JSON.parse(text);
      await importBackup(payload);
      setBackupMessage("Backup imported successfully.");
    } catch (err) {
      setBackupMessage(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBackupBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="Settings" subtitle="Profile, targets, and data" />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Profile</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Sex</label>
            <select
              className={inputClass}
              value={form.sex}
              onChange={(e) => setForm((p) => ({ ...p, sex: e.target.value as UserProfile["sex"] }))}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="intersex">Intersex</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Date of birth</label>
            <input
              type="date"
              className={inputClass}
              value={form.dateOfBirth ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value || null }))}
            />
          </div>

          <div>
            <label className={labelClass}>Height (cm)</label>
            <input
              type="number"
              className={inputClass}
              value={form.heightCm ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, heightCm: e.target.value === "" ? null : Number(e.target.value) }))}
            />
          </div>

          <div>
            <label className={labelClass}>Current weight (lb)</label>
            <input
              type="number"
              className={inputClass}
              value={form.currentWeightLb}
              onChange={(e) => setForm((p) => ({ ...p, currentWeightLb: Number(e.target.value) }))}
            />
          </div>

          <div>
            <label className={labelClass}>Resting heart rate (bpm)</label>
            <input
              type="number"
              className={inputClass}
              value={form.restingHeartRate ?? ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, restingHeartRate: e.target.value === "" ? null : Number(e.target.value) }))
              }
            />
          </div>

          <div>
            <label className={labelClass}>Observed max heart rate (bpm)</label>
            <input
              type="number"
              className={inputClass}
              value={form.observedMaxHeartRate ?? ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  observedMaxHeartRate: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            />
          </div>

          <div>
            <label className={labelClass}>Preferred units</label>
            <select
              className={inputClass}
              value={form.preferredUnits}
              onChange={(e) => setForm((p) => ({ ...p, preferredUnits: e.target.value as UserProfile["preferredUnits"] }))}
            >
              <option value="imperial">Imperial</option>
              <option value="metric">Metric</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Weight goal</label>
            <select
              className={inputClass}
              value={form.weightGoal}
              onChange={(e) => setForm((p) => ({ ...p, weightGoal: e.target.value as UserProfile["weightGoal"] }))}
            >
              <option value="gain_muscle">Gain muscle</option>
              <option value="lose_fat">Lose fat</option>
              <option value="maintain">Maintain</option>
              <option value="performance">Performance</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={form.addExerciseCaloriesToBudget}
              onChange={(e) => setForm((p) => ({ ...p, addExerciseCaloriesToBudget: e.target.checked }))}
            />
            Add exercise calories back to daily budget
          </label>

          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                checked={form.contraception.hormonal}
                onChange={(e) =>
                  setForm((p) => ({ ...p, contraception: { ...p.contraception, hormonal: e.target.checked } }))
                }
              />
              Using hormonal contraception
            </label>
            {form.contraception.hormonal && (
              <div>
                <label className={labelClass}>Type</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. combined pill, IUD"
                  value={form.contraception.type ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, contraception: { ...p.contraception, type: e.target.value || null } }))
                  }
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Nutrition targets</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Calorie goal (kcal)</label>
            <input
              type="number"
              className={inputClass}
              value={form.calorieGoal}
              onChange={(e) => setForm((p) => ({ ...p, calorieGoal: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className={labelClass}>Protein goal (g)</label>
            <input
              type="number"
              className={inputClass}
              value={form.proteinGoalG}
              onChange={(e) => setForm((p) => ({ ...p, proteinGoalG: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className={labelClass}>Fiber goal (g)</label>
            <input
              type="number"
              className={inputClass}
              value={form.fiberGoalG}
              onChange={(e) => setForm((p) => ({ ...p, fiberGoalG: Number(e.target.value) }))}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Training schedule</h2>
        <div className="flex flex-col gap-2">
          {DAYS.map((day) => {
            const plan = scheduleFor(day);
            return (
              <div key={day} className="flex items-center gap-2">
                <span className="w-9 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {DAY_LABEL[day].slice(0, 3)}
                </span>
                <select
                  className={`${inputClass} flex-1`}
                  value={plan.activityType}
                  onChange={(e) => updateSchedule(day, { activityType: e.target.value as ActivityType })}
                >
                  {ACTIVITY_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a[0]!.toUpperCase() + a.slice(1)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className={`${inputClass} w-24`}
                  placeholder="default"
                  value={plan.calorieTarget ?? ""}
                  onChange={(e) =>
                    updateSchedule(day, { calorieTarget: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Leave the calorie box empty to use the default target for that activity type.
        </p>
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saveState === "saving" ? "Saving…" : "Save"}
        </button>
        {saveState === "saved" && <span className="text-sm text-accent">Saved.</span>}
        {saveState === "error" && <span className="text-sm text-red-600">{saveError}</span>}
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Apple Health import</h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          On your iPhone: Settings app → Health → tap your profile picture → Export All Health Data, then unzip and
          select the export.xml file here.
        </p>
        <input type="file" accept=".xml" onChange={handleAppleHealthFile} disabled={healthBusy} className="text-sm" />
        {healthBusy && <p className="mt-2 text-sm text-slate-400">Importing…</p>}
        {healthError && <p className="mt-2 text-sm text-red-600">{healthError}</p>}
        {healthSummary && (
          <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            <li>Workouts added: {healthSummary.workoutsAdded}</li>
            <li>Workouts skipped as duplicate: {healthSummary.workoutsSkippedAsDuplicate}</li>
            <li>Daily metrics merged: {healthSummary.dailyMetricsMerged}</li>
            {healthSummary.warnings.length > 0 && (
              <li>
                Warnings:
                <ul className="ml-4 list-disc">
                  {healthSummary.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Strong CSV import</h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Export your workout history from the Strong app as a CSV file, then select it here.
        </p>
        <input type="file" accept=".csv" onChange={handleStrongFile} disabled={strongBusy} className="text-sm" />
        {strongBusy && <p className="mt-2 text-sm text-slate-400">Importing…</p>}
        {strongError && <p className="mt-2 text-sm text-red-600">{strongError}</p>}
        {strongSummary && (
          <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            <li>Workouts added: {strongSummary.workoutsAdded}</li>
            <li>Workouts skipped as duplicate: {strongSummary.workoutsSkippedAsDuplicate}</li>
            {strongSummary.warnings.length > 0 && (
              <li>
                Warnings:
                <ul className="ml-4 list-disc">
                  {strongSummary.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Backup &amp; restore</h2>
        <div className="flex flex-col gap-3">
          <div>
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={backupBusy}
              className="rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent disabled:opacity-60"
            >
              Export backup
            </button>
          </div>
          <div>
            <label className={labelClass}>Import backup (.json)</label>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackupFile}
              disabled={backupBusy}
              className="text-sm"
            />
          </div>
          {backupMessage && <p className="text-sm text-slate-600 dark:text-slate-300">{backupMessage}</p>}
        </div>
      </Card>
    </div>
  );
}
