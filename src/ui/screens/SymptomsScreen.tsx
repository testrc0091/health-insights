import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuid } from "uuid";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { symptomEntryRepository } from "../../storage/repositories";
import type { SymptomEntry } from "../../storage/schemas/symptomAndRun";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const labelClass = "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400";

const BODY_AREA_SUGGESTIONS = [
  "hip",
  "knee",
  "shoulder",
  "back",
  "ankle",
  "wrist",
  "neck",
  "elbow",
  "hamstring",
  "calf",
];

const SYMPTOM_TYPES: SymptomEntry["symptomType"][] = [
  "pain",
  "tightness",
  "snapping",
  "numbness",
  "soreness",
  "swelling",
  "stiffness",
  "headache",
  "fatigue",
  "other",
];

const LATERALITY_OPTIONS: SymptomEntry["laterality"][] = ["left", "right", "bilateral", "n/a"];

const IMPACT_OPTIONS: NonNullable<SymptomEntry["impactOnTraining"]>[] = ["none", "modified", "shortened", "skipped"];

const FLAG_THRESHOLD = 7;

export function SymptomsScreen() {
  const [bodyArea, setBodyArea] = useState("");
  const [symptomType, setSymptomType] = useState<SymptomEntry["symptomType"]>("pain");
  const [severity, setSeverity] = useState(0);
  const [laterality, setLaterality] = useState<SymptomEntry["laterality"]>("n/a");
  const [trigger, setTrigger] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [impactOnTraining, setImpactOnTraining] = useState<"" | NonNullable<SymptomEntry["impactOnTraining"]>>("");
  const [notes, setNotes] = useState("");

  const allSymptoms = useLiveQuery(() => symptomEntryRepository.getAll(), []);

  const flaggedForReview = severity >= FLAG_THRESHOLD;

  async function handleSave() {
    if (bodyArea.trim() === "") return;
    const entry: SymptomEntry = {
      id: uuid(),
      dateTime: new Date().toISOString(),
      bodyArea: bodyArea.trim(),
      symptomType,
      severity,
      laterality,
      trigger: trigger.trim() === "" ? null : trigger.trim(),
      durationMinutes: durationMinutes.trim() === "" ? null : Number(durationMinutes),
      impactOnTraining: impactOnTraining === "" ? null : impactOnTraining,
      notes: notes.trim() === "" ? null : notes.trim(),
      flaggedForReview,
    };
    await symptomEntryRepository.put(entry);
    setBodyArea("");
    setSymptomType("pain");
    setSeverity(0);
    setLaterality("n/a");
    setTrigger("");
    setDurationMinutes("");
    setImpactOnTraining("");
    setNotes("");
  }

  async function handleDelete(id: string) {
    await symptomEntryRepository.delete(id);
  }

  const groupedByBodyArea = useMemo(() => {
    if (!allSymptoms) return [];
    const groups = new Map<string, SymptomEntry[]>();
    for (const entry of allSymptoms) {
      const list = groups.get(entry.bodyArea) ?? [];
      list.push(entry);
      groups.set(entry.bodyArea, list);
    }
    return Array.from(groups.entries())
      .map(([area, entries]) => ({
        bodyArea: area,
        entries: [...entries].sort((a, b) => b.dateTime.localeCompare(a.dateTime)),
        chartData: [...entries]
          .sort((a, b) => a.dateTime.localeCompare(b.dateTime))
          .map((entry) => ({
            date: new Date(entry.dateTime).toLocaleDateString(),
            severity: entry.severity,
          })),
      }))
      .sort((a, b) => a.bodyArea.localeCompare(b.bodyArea));
  }, [allSymptoms]);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="Symptoms" subtitle="Track pain, tightness, and other symptoms by body area" />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Log symptom</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Body area</label>
            <input
              list="body-area-suggestions"
              type="text"
              value={bodyArea}
              onChange={(e) => setBodyArea(e.target.value)}
              placeholder="e.g. knee"
              className={inputClass}
            />
            <datalist id="body-area-suggestions">
              {BODY_AREA_SUGGESTIONS.map((area) => (
                <option key={area} value={area} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={labelClass}>Symptom type</label>
            <select
              value={symptomType}
              onChange={(e) => setSymptomType(e.target.value as SymptomEntry["symptomType"])}
              className={inputClass}
            >
              {SYMPTOM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Severity (0-10)</label>
            <input
              type="range"
              min={0}
              max={10}
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>0</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{severity}</span>
              <span>10</span>
            </div>
            {flaggedForReview && (
              <p className="mt-1 text-xs font-medium text-accent">This may be worth a clinical check-in.</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Laterality</label>
            <select
              value={laterality}
              onChange={(e) => setLaterality(e.target.value as SymptomEntry["laterality"])}
              className={inputClass}
            >
              {LATERALITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Trigger</label>
            <input
              type="text"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="optional"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Duration (minutes)</label>
            <input
              type="number"
              min={0}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Impact on training</label>
            <select
              value={impactOnTraining}
              onChange={(e) =>
                setImpactOnTraining(e.target.value as "" | NonNullable<SymptomEntry["impactOnTraining"]>)
              }
              className={inputClass}
            >
              <option value="">Not recorded</option>
              {IMPACT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Save symptom
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">History</h2>
        {groupedByBodyArea.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No symptoms logged yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {groupedByBodyArea.map((group) => (
              <div key={group.bodyArea}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {group.bodyArea}
                </h3>
                <ul className="flex flex-col gap-1">
                  {group.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between border-b border-slate-100 pb-1 text-sm last:border-0 dark:border-slate-800"
                    >
                      <div>
                        <span className="font-medium text-slate-800 dark:text-slate-100">{entry.symptomType}</span>
                        <span className="ml-2 text-slate-500 dark:text-slate-400">
                          severity {entry.severity} &middot; {new Date(entry.dateTime).toLocaleString()}
                        </span>
                        {entry.flaggedForReview && (
                          <span className="ml-2 rounded-full bg-accent-muted/40 px-2 py-0.5 text-xs font-medium text-accent">
                            Consider a clinical check-in
                          </span>
                        )}
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
                {group.chartData.length > 1 && (
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={group.chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 10]} allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="severity" stroke="#db2777" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
