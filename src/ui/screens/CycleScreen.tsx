import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuid } from "uuid";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../components/Card";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import { PageHeader } from "../components/PageHeader";
import { useAppContext } from "../../app/AppProviders";
import { toIsoDate } from "../../domain/dateUtils";
import { cycleDayForDate, describePhase, phaseForDate } from "../../domain/cycle/phaseEstimation";
import { recomputeCycles } from "../../app/services/cycleService";
import {
  cycleRepository,
  dailyMetricsRepository,
  getMenstrualEntriesInRange,
  getMostRecentCycle,
  menstrualCycleEntryRepository,
} from "../../storage/repositories";
import type { MenstrualCycleEntry, Cycle } from "../../storage/schemas/cycle";
import type { ConfidenceTier } from "../../domain/models/common";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const labelClass = "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400";

const BLEEDING_OPTIONS: MenstrualCycleEntry["bleeding"][] = ["none", "spotting", "light", "medium", "heavy"];
const OVULATION_TEST_OPTIONS: NonNullable<MenstrualCycleEntry["ovulationTestResult"]>[] = [
  "positive",
  "negative",
  "not_tested",
];
const RATING_FIELDS: { key: RatingFieldKey; label: string }[] = [
  { key: "cramps", label: "Cramps" },
  { key: "bloating", label: "Bloating" },
  { key: "headache", label: "Headache" },
  { key: "fatigue", label: "Fatigue" },
  { key: "mood", label: "Mood" },
  { key: "irritability", label: "Irritability" },
  { key: "hunger", label: "Hunger" },
  { key: "sleepDisruption", label: "Sleep disruption" },
];

type RatingFieldKey =
  | "cramps"
  | "bloating"
  | "headache"
  | "fatigue"
  | "mood"
  | "irritability"
  | "hunger"
  | "sleepDisruption";

interface CycleFormState {
  bleeding: MenstrualCycleEntry["bleeding"];
  periodStart: boolean;
  periodEnd: boolean;
  cramps: string;
  bloating: string;
  headache: string;
  fatigue: string;
  mood: string;
  irritability: string;
  cravings: string;
  hunger: string;
  sleepDisruption: string;
  acneFlare: boolean;
  ovulationTestResult: "" | NonNullable<MenstrualCycleEntry["ovulationTestResult"]>;
  basalBodyTempF: string;
  notes: string;
}

const EMPTY_FORM: CycleFormState = {
  bleeding: "none",
  periodStart: false,
  periodEnd: false,
  cramps: "",
  bloating: "",
  headache: "",
  fatigue: "",
  mood: "",
  irritability: "",
  cravings: "",
  hunger: "",
  sleepDisruption: "",
  acneFlare: false,
  ovulationTestResult: "",
  basalBodyTempF: "",
  notes: "",
};

function parseRating(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(0, n));
}

function parseCravings(value: string): string[] | null {
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const CYCLE_LINE_COLORS = ["#db2777", "#f472b6", "#fbcfe8"];

interface CycleChartSeries {
  cycle: Cycle;
  points: { cycleDay: number; value: number }[];
}

export function CycleScreen() {
  const { userProfile } = useAppContext();
  const today = toIsoDate(new Date());

  const [selectedDate, setSelectedDate] = useState(today);
  const [form, setForm] = useState<CycleFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const allEntries = useLiveQuery(() => menstrualCycleEntryRepository.getAll(), []);
  const mostRecentCycle = useLiveQuery(() => getMostRecentCycle(), []);

  useEffect(() => {
    if (!allEntries) return;
    const existing = allEntries.find((e) => e.date === selectedDate);
    if (existing) {
      setEditingId(existing.id);
      setForm({
        bleeding: existing.bleeding,
        periodStart: existing.periodStart,
        periodEnd: existing.periodEnd,
        cramps: existing.cramps?.toString() ?? "",
        bloating: existing.bloating?.toString() ?? "",
        headache: existing.headache?.toString() ?? "",
        fatigue: existing.fatigue?.toString() ?? "",
        mood: existing.mood?.toString() ?? "",
        irritability: existing.irritability?.toString() ?? "",
        cravings: existing.cravings?.join(", ") ?? "",
        hunger: existing.hunger?.toString() ?? "",
        sleepDisruption: existing.sleepDisruption?.toString() ?? "",
        acneFlare: existing.acneFlare ?? false,
        ovulationTestResult: existing.ovulationTestResult ?? "",
        basalBodyTempF: existing.basalBodyTempF?.toString() ?? "",
        notes: existing.notes ?? "",
      });
    } else {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  }, [selectedDate, allEntries]);

  function setRatingField(key: RatingFieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const entry: MenstrualCycleEntry = {
      id: editingId ?? uuid(),
      date: selectedDate,
      bleeding: form.bleeding,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      cramps: parseRating(form.cramps),
      breastTenderness: null,
      bloating: parseRating(form.bloating),
      headache: parseRating(form.headache),
      fatigue: parseRating(form.fatigue),
      mood: parseRating(form.mood),
      irritability: parseRating(form.irritability),
      cravings: parseCravings(form.cravings),
      hunger: parseRating(form.hunger),
      sleepDisruption: parseRating(form.sleepDisruption),
      giSymptoms: null,
      acneFlare: form.acneFlare,
      libido: null,
      cervicalMucus: null,
      ovulationTestResult: form.ovulationTestResult === "" ? null : form.ovulationTestResult,
      basalBodyTempF: form.basalBodyTempF.trim() === "" ? null : Number(form.basalBodyTempF),
      notes: form.notes.trim() === "" ? null : form.notes,
    };
    await menstrualCycleEntryRepository.put(entry);
    await recomputeCycles();
    setEditingId(entry.id);
  }

  async function handleDelete(id: string) {
    await menstrualCycleEntryRepository.delete(id);
    await recomputeCycles();
  }

  let phaseLine: string | null = null;
  let confidenceTier: ConfidenceTier = "low";
  let cycleDay: number | null = null;

  if (mostRecentCycle) {
    cycleDay = cycleDayForDate(today, mostRecentCycle.startDate);
    const phaseWindow = {
      estimatedOvulationDate: mostRecentCycle.estimatedOvulationDate?.value ?? mostRecentCycle.startDate,
      follicularRange: mostRecentCycle.follicularPhaseRange ?? {
        start: mostRecentCycle.startDate,
        end: mostRecentCycle.startDate,
      },
      lutealRange: mostRecentCycle.lutealPhaseRange ?? {
        start: mostRecentCycle.startDate,
        end: mostRecentCycle.startDate,
      },
    };
    const phase = phaseForDate(today, mostRecentCycle.startDate, mostRecentCycle.periodLengthDays ?? 5, phaseWindow);
    phaseLine = describePhase(phase, mostRecentCycle.phaseConfidence);
    confidenceTier =
      mostRecentCycle.phaseConfidence === "high"
        ? "high"
        : mostRecentCycle.phaseConfidence === "medium"
          ? "moderate"
          : "low";
  }

  const weightNote = useLiveQuery(async () => {
    const cycle = mostRecentCycle;
    if (!cycle || !cycle.lutealPhaseRange) return null;
    const luteal = cycle.lutealPhaseRange;
    const cycleEnd = cycle.endDate ?? toIsoDate(new Date());
    const allMetrics = await dailyMetricsRepository.getAll();
    const inCycle = allMetrics.filter(
      (m) => m.date >= cycle.startDate && m.date <= cycleEnd && m.weightLb != null,
    );
    const lutealWeights = inCycle
      .filter((m) => m.date >= luteal.start && m.date <= luteal.end)
      .map((m) => m.weightLb as number);
    const restWeights = inCycle
      .filter((m) => !(m.date >= luteal.start && m.date <= luteal.end))
      .map((m) => m.weightLb as number);
    if (lutealWeights.length === 0 || restWeights.length === 0) return null;
    const lutealAvg = average(lutealWeights);
    const restAvg = average(restWeights);
    return { lutealAvg, restAvg, diff: lutealAvg - restAvg };
  }, [mostRecentCycle?.id]);

  const cycleChartSeries = useLiveQuery(async (): Promise<CycleChartSeries[]> => {
    const cycles = (await cycleRepository.getAll()).sort((a, b) => a.startDate.localeCompare(b.startDate));
    const lastCycles = cycles.slice(-3);
    const todayIso = toIsoDate(new Date());
    return Promise.all(
      lastCycles.map(async (cycle) => {
        const entries = await getMenstrualEntriesInRange(cycle.startDate, cycle.endDate ?? todayIso);
        const points = entries.map((entry) => ({
          cycleDay: cycleDayForDate(entry.date, cycle.startDate),
          value: entry.cramps ?? 0,
        }));
        return { cycle, points };
      }),
    );
  }, []);

  const cycleChartRows = useMemo(() => {
    if (!cycleChartSeries) return [];
    const byDay = new Map<number, Record<string, number>>();
    for (const { cycle, points } of cycleChartSeries) {
      for (const point of points) {
        const row: Record<string, number> = byDay.get(point.cycleDay) ?? { cycleDay: point.cycleDay };
        row[cycle.startDate] = point.value;
        byDay.set(point.cycleDay, row);
      }
    }
    return Array.from(byDay.values()).sort((a, b) => a.cycleDay - b.cycleDay);
  }, [cycleChartSeries]);

  const historyEntries = useMemo(() => {
    if (!allEntries) return [];
    return [...allEntries].sort((a, b) => b.date.localeCompare(a.date));
  }, [allEntries]);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="Cycle" subtitle="Log symptoms and track phase estimates" />

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Current status</h2>
        {mostRecentCycle ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700 dark:text-slate-200">
                Cycle day {cycleDay} &middot; {phaseLine}
              </span>
              <ConfidenceBadge tier={confidenceTier} />
            </div>
            {userProfile.contraception.hormonal && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Phase estimation is suppressed to low confidence because hormonal contraception is in use — natural
                cycle timing assumptions don't reliably apply.
              </p>
            )}
            {weightNote && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Average weight during the luteal phase this cycle ({weightNote.lutealAvg.toFixed(1)} lb) was{" "}
                {Math.abs(weightNote.diff).toFixed(1)} lb {weightNote.diff >= 0 ? "higher" : "lower"} than the rest of
                the cycle ({weightNote.restAvg.toFixed(1)} lb).
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No cycle data yet — log a period start below to begin tracking.
          </p>
        )}
      </Card>

      {cycleChartSeries && cycleChartSeries.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Cycle comparison (cramps)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cycleChartRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="cycleDay" label={{ value: "Cycle day", position: "insideBottom", offset: -5 }} />
              <YAxis domain={[0, 10]} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {cycleChartSeries.map((series, index) => (
                <Line
                  key={series.cycle.startDate}
                  type="monotone"
                  dataKey={series.cycle.startDate}
                  name={`Started ${series.cycle.startDate}`}
                  stroke={CYCLE_LINE_COLORS[index % CYCLE_LINE_COLORS.length] ?? "#db2777"}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Log entry</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Date</label>
            <input
              type="date"
              max={today}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Bleeding</label>
            <select
              value={form.bleeding}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, bleeding: e.target.value as MenstrualCycleEntry["bleeding"] }))
              }
              className={inputClass}
            >
              {BLEEDING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.periodStart}
                onChange={(e) => setForm((prev) => ({ ...prev, periodStart: e.target.checked }))}
              />
              Period start
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.periodEnd}
                onChange={(e) => setForm((prev) => ({ ...prev, periodEnd: e.target.checked }))}
              />
              Period end
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {RATING_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className={labelClass}>{label} (0-10)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form[key]}
                  onChange={(e) => setRatingField(key, e.target.value)}
                  className={inputClass}
                />
              </div>
            ))}
          </div>

          <div>
            <label className={labelClass}>Cravings (comma-separated)</label>
            <input
              type="text"
              value={form.cravings}
              onChange={(e) => setForm((prev) => ({ ...prev, cravings: e.target.value }))}
              placeholder="e.g. chocolate, salty snacks"
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.acneFlare}
              onChange={(e) => setForm((prev) => ({ ...prev, acneFlare: e.target.checked }))}
            />
            Acne flare
          </label>

          <div>
            <label className={labelClass}>Ovulation test result</label>
            <select
              value={form.ovulationTestResult}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  ovulationTestResult: e.target.value as CycleFormState["ovulationTestResult"],
                }))
              }
              className={inputClass}
            >
              <option value="">Not recorded</option>
              {OVULATION_TEST_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Basal body temp (&deg;F)</label>
            <input
              type="number"
              step="0.1"
              value={form.basalBodyTempF}
              onChange={(e) => setForm((prev) => ({ ...prev, basalBodyTempF: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className={inputClass}
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            {editingId ? "Update entry" : "Save entry"}
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">History</h2>
        {historyEntries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No entries logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {historyEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0 dark:border-slate-800"
              >
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{entry.date}</span>
                  <span className="ml-2 text-slate-500 dark:text-slate-400">
                    {entry.bleeding !== "none" ? entry.bleeding : "no bleeding"}
                    {entry.periodStart ? " · start" : ""}
                    {entry.periodEnd ? " · end" : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(entry.id)}
                  className="text-xs font-medium text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
