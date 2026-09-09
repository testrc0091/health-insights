import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuid } from "uuid";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { toIsoDate } from "../../domain/dateUtils";
import { runSessionRepository } from "../../storage/repositories";
import type { RunInterval, RunSession } from "../../storage/schemas/symptomAndRun";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const labelClass = "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400";

interface ProtocolPreset {
  label: string;
  protocol: string;
  intervals: RunInterval[];
}

function buildWalkRunIntervals(repeats: number, walkMinutes: number, runMinutes: number): RunInterval[] {
  const intervals: RunInterval[] = [];
  for (let i = 0; i < repeats; i++) {
    intervals.push({ type: "walk", minutes: walkMinutes, symptomsDuring: null });
    intervals.push({ type: "run", minutes: runMinutes, symptomsDuring: null });
  }
  return intervals;
}

const PRESETS: ProtocolPreset[] = [
  {
    label: "Week 1",
    protocol: "Week 1: 6x(4 min walk / 1 min run)",
    intervals: buildWalkRunIntervals(6, 4, 1),
  },
  {
    label: "Week 2",
    protocol: "Week 2: 5x(3 min walk / 2 min run)",
    intervals: buildWalkRunIntervals(5, 3, 2),
  },
  {
    label: "Week 3",
    protocol: "Week 3: continuous 20 min run",
    intervals: [{ type: "run", minutes: 20, symptomsDuring: null }],
  },
];

const STATUS_BADGE: Record<"green" | "yellow" | "red", string> = {
  green: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  yellow: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function ReturnToRunScreen() {
  const [protocol, setProtocol] = useState("");
  const [intervals, setIntervals] = useState<RunInterval[]>([]);
  const [distanceMiles, setDistanceMiles] = useState("");
  const [paceMinPerMile, setPaceMinPerMile] = useState("");
  const [averageHeartRate, setAverageHeartRate] = useState("");
  const [symptomsAfter, setSymptomsAfter] = useState("");
  const [nextDaySymptoms, setNextDaySymptoms] = useState("");
  const [progressionOverride, setProgressionOverride] = useState<"" | "green" | "yellow" | "red">("");

  const allSessions = useLiveQuery(() => runSessionRepository.getAll(), []);

  const computedProgressionStatus: "green" | "yellow" | "red" =
    nextDaySymptoms.trim() !== "" ? "red" : symptomsAfter.trim() !== "" ? "yellow" : "green";
  const progressionStatus = progressionOverride === "" ? computedProgressionStatus : progressionOverride;

  function applyPreset(preset: ProtocolPreset) {
    setProtocol(preset.protocol);
    setIntervals(preset.intervals.map((interval) => ({ ...interval })));
  }

  function addInterval() {
    setIntervals((prev) => [...prev, { type: "walk", minutes: 1, symptomsDuring: null }]);
  }

  function removeInterval(index: number) {
    setIntervals((prev) => prev.filter((_, i) => i !== index));
  }

  function updateIntervalType(index: number, type: RunInterval["type"]) {
    setIntervals((prev) => prev.map((interval, i) => (i === index ? { ...interval, type } : interval)));
  }

  function updateIntervalMinutes(index: number, minutes: number) {
    setIntervals((prev) => prev.map((interval, i) => (i === index ? { ...interval, minutes } : interval)));
  }

  function updateIntervalSymptoms(index: number, symptomsDuring: string) {
    setIntervals((prev) => prev.map((interval, i) => (i === index ? { ...interval, symptomsDuring } : interval)));
  }

  async function handleSave() {
    if (protocol.trim() === "") return;
    const normalizedIntervals: RunInterval[] = intervals.map((interval) => ({
      type: interval.type,
      minutes: interval.minutes,
      symptomsDuring:
        interval.symptomsDuring && interval.symptomsDuring.trim() !== "" ? interval.symptomsDuring.trim() : null,
    }));
    const session: RunSession = {
      id: uuid(),
      date: toIsoDate(new Date()),
      workoutId: null,
      protocol: protocol.trim(),
      intervals: normalizedIntervals,
      distanceMiles: distanceMiles.trim() === "" ? null : Number(distanceMiles),
      paceMinPerMile: paceMinPerMile.trim() === "" ? null : Number(paceMinPerMile),
      averageHeartRate: averageHeartRate.trim() === "" ? null : Number(averageHeartRate),
      symptomsAfter: symptomsAfter.trim() === "" ? null : symptomsAfter.trim(),
      nextDaySymptoms: nextDaySymptoms.trim() === "" ? null : nextDaySymptoms.trim(),
      progressionStatus,
    };
    await runSessionRepository.put(session);
    setProtocol("");
    setIntervals([]);
    setDistanceMiles("");
    setPaceMinPerMile("");
    setAverageHeartRate("");
    setSymptomsAfter("");
    setNextDaySymptoms("");
    setProgressionOverride("");
  }

  async function handleDelete(id: string) {
    await runSessionRepository.delete(id);
  }

  const sortedSessions = useMemo(() => {
    if (!allSessions) return [];
    return [...allSessions].sort((a, b) => b.date.localeCompare(a.date));
  }, [allSessions]);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="Return to Run" subtitle="Walk/run protocols and progression tracking" />

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Protocol presets</h2>
        <div className="flex flex-col gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-left text-sm text-slate-700 hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-200"
            >
              <span className="font-medium">{preset.label}:</span> {preset.protocol}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Log run session</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Protocol</label>
            <input
              type="text"
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Intervals</label>
            <div className="flex flex-col gap-2">
              {intervals.map((interval, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={interval.type}
                    onChange={(e) => updateIntervalType(index, e.target.value as RunInterval["type"])}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="walk">walk</option>
                    <option value="run">run</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={interval.minutes}
                    onChange={(e) => updateIntervalMinutes(index, Number(e.target.value))}
                    className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">min</span>
                  <input
                    type="text"
                    value={interval.symptomsDuring ?? ""}
                    onChange={(e) => updateIntervalSymptoms(index, e.target.value)}
                    placeholder="symptoms during (optional)"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeInterval(index)}
                    className="text-xs font-medium text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addInterval}
                className="self-start rounded-lg border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-300"
              >
                + Add interval
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Distance (miles)</label>
              <input
                type="number"
                step="0.01"
                value={distanceMiles}
                onChange={(e) => setDistanceMiles(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Pace (min/mile)</label>
              <input
                type="number"
                step="0.1"
                value={paceMinPerMile}
                onChange={(e) => setPaceMinPerMile(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Average heart rate</label>
            <input
              type="number"
              value={averageHeartRate}
              onChange={(e) => setAverageHeartRate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Symptoms after</label>
            <input
              type="text"
              value={symptomsAfter}
              onChange={(e) => setSymptomsAfter(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Next-day symptoms</label>
            <input
              type="text"
              value={nextDaySymptoms}
              onChange={(e) => setNextDaySymptoms(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Progression status (computed: <span className="font-medium">{computedProgressionStatus}</span>)
            </label>
            <select
              value={progressionOverride}
              onChange={(e) => setProgressionOverride(e.target.value as "" | "green" | "yellow" | "red")}
              className={inputClass}
            >
              <option value="">Use computed value</option>
              <option value="green">green</option>
              <option value="yellow">yellow</option>
              <option value="red">red</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Save session
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">History</h2>
        {sortedSessions.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No run sessions logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedSessions.map((session) => {
              const totalMinutes = session.intervals.reduce((sum, interval) => sum + interval.minutes, 0);
              const status = session.progressionStatus ?? "green";
              return (
                <li
                  key={session.id}
                  className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0 dark:border-slate-800"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{session.date}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
                        {status}
                      </span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {session.protocol} &middot; {totalMinutes} min total
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(session.id)}
                    className="text-xs font-medium text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
