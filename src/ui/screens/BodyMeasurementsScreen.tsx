import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuid } from "uuid";
import { differenceInCalendarDays, format as formatDateLabel } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { bodyMeasurementRepository, dailyMetricsRepository, getBodyMeasurementsByType } from "../../storage/repositories";
import type { BodyMeasurement, MeasurementType } from "../../storage/schemas/bodyMeasurement";
import { toIsoDate, parseIsoDate } from "../../domain/dateUtils";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const labelClass = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";
const primaryButtonClass = "rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

const MEASUREMENT_TYPES: MeasurementType[] = [
  "waist",
  "hips",
  "neck",
  "chest",
  "shoulders",
  "upper_arm",
  "forearm",
  "thigh",
  "calf",
  "custom",
];

const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  waist: "Waist",
  hips: "Hips",
  neck: "Neck",
  chest: "Chest",
  shoulders: "Shoulders",
  upper_arm: "Upper arm",
  forearm: "Forearm",
  thigh: "Thigh",
  calf: "Calf",
  custom: "Custom",
};

function describeChange(delta: number, unit: string, flatThreshold: number): string {
  if (Math.abs(delta) < flatThreshold) return "roughly flat";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}${unit}`;
}

export function BodyMeasurementsScreen() {
  // ---- Log form ----
  const [logType, setLogType] = useState<MeasurementType>("waist");
  const [logCustomLabel, setLogCustomLabel] = useState("");
  const [logSide, setLogSide] = useState<BodyMeasurement["side"]>("n/a");
  const [logValueCm, setLogValueCm] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [logMessage, setLogMessage] = useState<string | null>(null);

  async function handleSaveMeasurement() {
    const valueCm = Number(logValueCm);
    if (logValueCm.trim() === "" || !Number.isFinite(valueCm)) {
      setLogMessage("Enter a numeric value in cm.");
      return;
    }
    const measurement: BodyMeasurement = {
      id: uuid(),
      date: toIsoDate(new Date()),
      measurementType: logType,
      customLabel: logType === "custom" ? (logCustomLabel.trim() === "" ? null : logCustomLabel.trim()) : null,
      side: logSide,
      valueCm,
      photoBlobId: null,
      notes: logNotes.trim() === "" ? null : logNotes.trim(),
    };
    await bodyMeasurementRepository.put(measurement);
    setLogValueCm("");
    setLogNotes("");
    setLogMessage("Saved.");
  }

  // ---- History chart, driven by a type picker ----
  const [chartType, setChartType] = useState<MeasurementType>("waist");
  const chartHistory = useLiveQuery(() => getBodyMeasurementsByType(chartType), [chartType]);

  const chartData = useMemo(
    () => (chartHistory ?? []).map((m) => ({ date: m.date, valueCm: m.valueCm })),
    [chartHistory],
  );

  // ---- Cross-analysis vs. weight ----
  const weightSeries = useLiveQuery(async () => {
    const all = await dailyMetricsRepository.getAll();
    return all.filter((d) => d.weightLb != null).sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  const crossAnalysisCaption = useMemo(() => {
    if (!chartHistory || chartHistory.length < 2 || !weightSeries || weightSeries.length < 2) return null;
    const first = chartHistory[0]!;
    const last = chartHistory[chartHistory.length - 1]!;
    if (first.date === last.date) return null;

    const weightInRange = weightSeries.filter((d) => d.date >= first.date && d.date <= last.date);
    if (weightInRange.length < 2) return null;
    const weightFirst = weightInRange[0]!;
    const weightLast = weightInRange[weightInRange.length - 1]!;

    const measurementDelta = last.valueCm - first.valueCm;
    const weightDelta = (weightLast.weightLb ?? 0) - (weightFirst.weightLb ?? 0);

    const days = differenceInCalendarDays(parseIsoDate(last.date), parseIsoDate(first.date));
    const weeks = Math.max(1, Math.round(days / 7));
    const label = MEASUREMENT_LABELS[chartType];

    return `${label} ${describeChange(measurementDelta, "cm", 0.3)} while weight is ${describeChange(
      weightDelta,
      " lb",
      1,
    )}, over the last ${weeks} week${weeks === 1 ? "" : "s"}.`;
  }, [chartHistory, weightSeries, chartType]);

  // ---- History list (most recent first) ----
  const historyDescending = useMemo(() => [...(chartHistory ?? [])].reverse(), [chartHistory]);

  async function handleDelete(id: string) {
    await bodyMeasurementRepository.delete(id);
  }

  return (
    <div className="space-y-6 pb-6">
      <PageHeader title="Body measurements" subtitle="Tape-measure tracking alongside weight" />

      {/* Log form */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Log a measurement</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Type</label>
            <select
              className={inputClass}
              value={logType}
              onChange={(e) => setLogType(e.target.value as MeasurementType)}
            >
              {MEASUREMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MEASUREMENT_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Side</label>
            <select
              className={inputClass}
              value={logSide}
              onChange={(e) => setLogSide(e.target.value as BodyMeasurement["side"])}
            >
              <option value="n/a">N/A</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
          {logType === "custom" && (
            <div className="col-span-2">
              <label className={labelClass}>Custom label</label>
              <input
                type="text"
                className={inputClass}
                value={logCustomLabel}
                onChange={(e) => setLogCustomLabel(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className={labelClass}>Value (cm)</label>
            <input
              type="number"
              className={inputClass}
              value={logValueCm}
              onChange={(e) => setLogValueCm(e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Notes (optional)</label>
            <input type="text" className={inputClass} value={logNotes} onChange={(e) => setLogNotes(e.target.value)} />
          </div>
        </div>
        <button type="button" className={`${primaryButtonClass} mt-3`} onClick={() => void handleSaveMeasurement()}>
          Save
        </button>
        {logMessage && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{logMessage}</p>}
      </Card>

      {/* History chart */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">History</h2>
          <select
            className={`${inputClass} w-auto`}
            value={chartType}
            onChange={(e) => setChartType(e.target.value as MeasurementType)}
          >
            {MEASUREMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {MEASUREMENT_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {chartData.length >= 2 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={35} />
                <Tooltip />
                <Line type="monotone" dataKey="valueCm" stroke="#ec4899" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Not enough {MEASUREMENT_LABELS[chartType].toLowerCase()} entries yet to chart a trend.
          </p>
        )}

        {crossAnalysisCaption && (
          <p className="mt-3 rounded-lg bg-accent-muted/20 p-2 text-xs text-slate-600 dark:text-slate-300">
            {crossAnalysisCaption}
          </p>
        )}
      </Card>

      {/* History list */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {MEASUREMENT_LABELS[chartType]} entries
        </h2>
        {historyDescending.length === 0 ? (
          <p className="text-sm text-slate-400">No entries yet.</p>
        ) : (
          <ul className="space-y-2">
            {historyDescending.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-200">
                  {formatDateLabel(parseIsoDate(m.date), "MMM d, yyyy")} — {m.valueCm} cm
                  {m.side !== "n/a" ? ` (${m.side})` : ""}
                  {m.customLabel ? ` — ${m.customLabel}` : ""}
                </span>
                <button
                  type="button"
                  className="text-xs font-medium text-accent underline"
                  onClick={() => void handleDelete(m.id)}
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
