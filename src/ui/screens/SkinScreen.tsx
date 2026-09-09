import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuid } from "uuid";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { toIsoDate } from "../../domain/dateUtils";
import { skinEntryRepository, skincareChangeRepository } from "../../storage/repositories";
import type { SkinEntry, SkincareChange } from "../../storage/schemas/skin";

const ACNE_SEVERITY_LABELS = ["None", "Mild", "Moderate", "Significant", "Severe"] as const;
const DRYNESS_IRRITATION_LABELS = ["None", "Mild", "Moderate", "Significant"] as const;

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function SeverityButtonGroup({
  value,
  onChange,
  labels,
}: {
  value: number;
  onChange: (value: number) => void;
  labels: readonly string[];
}) {
  return (
    <div className="flex gap-1">
      {labels.map((label, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={`flex-1 rounded-lg border px-1 py-2 text-center text-xs font-medium ${
            value === i
              ? "border-accent bg-accent text-white"
              : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
          }`}
          title={label}
        >
          {i}
        </button>
      ))}
    </div>
  );
}

function SkinEntryForm({ onSaved }: { onSaved: () => void }) {
  const [acneSeverity, setAcneSeverity] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [breakoutAreas, setBreakoutAreas] = useState("");
  const [lesionType, setLesionType] = useState("");
  const [dryness, setDryness] = useState<string>("");
  const [irritation, setIrritation] = useState<string>("");
  const [skincareProductsUsed, setSkincareProductsUsed] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const entry: SkinEntry = {
        id: uuid(),
        date: toIsoDate(new Date()),
        acneSeverity,
        breakoutAreas: parseCommaList(breakoutAreas),
        lesionType: lesionType.trim().length > 0 ? lesionType.trim() : null,
        dryness: dryness === "" ? null : (Number(dryness) as 0 | 1 | 2 | 3),
        irritation: irritation === "" ? null : (Number(irritation) as 0 | 1 | 2 | 3),
        photoBlobId: null,
        skincareProductsUsed: parseCommaList(skincareProductsUsed),
        notes: notes.trim().length > 0 ? notes.trim() : null,
      };
      await skinEntryRepository.put(entry);
      setAcneSeverity(0);
      setBreakoutAreas("");
      setLesionType("");
      setDryness("");
      setIrritation("");
      setSkincareProductsUsed("");
      setNotes("");
      onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Acne severity (0-4)
        </label>
        <SeverityButtonGroup value={acneSeverity} onChange={(v) => setAcneSeverity(v as 0 | 1 | 2 | 3 | 4)} labels={ACNE_SEVERITY_LABELS} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Breakout areas <span className="text-slate-400">(comma-separated)</span>
        </label>
        <input
          type="text"
          value={breakoutAreas}
          onChange={(e) => setBreakoutAreas(e.target.value)}
          placeholder="chin, forehead"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Lesion type <span className="text-slate-400">(optional)</span>
        </label>
        <input
          type="text"
          value={lesionType}
          onChange={(e) => setLesionType(e.target.value)}
          placeholder="cystic, whitehead, blackhead…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Dryness <span className="text-slate-400">(optional)</span>
          </label>
          <select
            value={dryness}
            onChange={(e) => setDryness(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">—</option>
            {DRYNESS_IRRITATION_LABELS.map((label, i) => (
              <option key={i} value={i}>
                {i} · {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Irritation <span className="text-slate-400">(optional)</span>
          </label>
          <select
            value={irritation}
            onChange={(e) => setIrritation(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">—</option>
            {DRYNESS_IRRITATION_LABELS.map((label, i) => (
              <option key={i} value={i}>
                {i} · {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Skincare products used <span className="text-slate-400">(comma-separated)</span>
        </label>
        <input
          type="text"
          value={skincareProductsUsed}
          onChange={(e) => setSkincareProductsUsed(e.target.value)}
          placeholder="cleanser, retinol serum"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Notes <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-full bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isSaving ? "Saving…" : "Save skin entry"}
      </button>
    </form>
  );
}

function SkincareChangeForm({ onSaved }: { onSaved: () => void }) {
  const [product, setProduct] = useState("");
  const [action, setAction] = useState<"started" | "stopped">("started");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (product.trim().length === 0) return;
    setIsSaving(true);
    try {
      const change: SkincareChange = {
        id: uuid(),
        date,
        product: product.trim(),
        action,
        reason: reason.trim().length > 0 ? reason.trim() : null,
      };
      await skincareChangeRepository.put(change);
      setProduct("");
      setAction("started");
      setReason("");
      setDate(toIsoDate(new Date()));
      onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Product</label>
          <input
            type="text"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="tretinoin 0.025%"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as "started" | "stopped")}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="started">Started</option>
            <option value="stopped">Stopped</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Reason <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="dermatologist recommendation"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSaving || product.trim().length === 0}
        className="rounded-full bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isSaving ? "Saving…" : "Log skincare change"}
      </button>
    </form>
  );
}

/** Acne/skin tracking: a SkinEntry log form, a separate SkincareChange log, an acne
 * severity trend chart with the change log listed underneath for visual correlation,
 * and history lists for both. Cross-domain correlation (skin vs. cycle/sleep/diet) is
 * intentionally left to the Trends screen's Personal Insights Engine rather than
 * recomputed here. */
export function SkinScreen() {
  // useLiveQuery re-runs automatically whenever the tables it read from change (a
  // Dexie liveQuery subscription under the hood), so a form's `put`/`delete` below is
  // reflected here without any manual refresh bookkeeping.
  const skinEntries = useLiveQuery(async () => {
    const all = await skinEntryRepository.getAll();
    return [...all].sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  const skincareChanges = useLiveQuery(async () => {
    const all = await skincareChangeRepository.getAll();
    return [...all].sort((a, b) => b.date.localeCompare(a.date));
  }, []);

  const entriesMostRecentFirst = skinEntries ? [...skinEntries].reverse() : undefined;

  async function handleDeleteEntry(id: string) {
    await skinEntryRepository.delete(id);
  }

  function bumpRefresh() {
    // No-op: useLiveQuery already reacts to the repository write. Kept as the
    // onSaved callback hook in case a form-level success affordance is added later.
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="Skin" subtitle="Track acne severity and skincare changes over time" />

      <Card className="bg-accent-muted/10 border-accent-muted/60">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          See the{" "}
          <Link to="/trends" className="text-accent underline">
            Trends
          </Link>{" "}
          tab for how your skin patterns relate to your cycle, sleep, and diet, once enough data has accumulated.
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Acne severity trend</h2>
        {skinEntries === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : skinEntries.length < 2 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Log a few more entries to see a trend.</p>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={skinEntries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" hide />
                <YAxis domain={[0, 4]} width={24} tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="acneSeverity" stroke="#ec4899" dot strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Skincare changes
        </h3>
        {skincareChanges === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : skincareChanges.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No skincare changes logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {skincareChanges.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-200">
                  {c.product}{" "}
                  <span className={c.action === "started" ? "text-accent" : "text-slate-400"}>{c.action}</span>
                  {c.reason ? <span className="text-slate-400"> — {c.reason}</span> : null}
                </span>
                <span className="text-slate-400 dark:text-slate-500">{c.date}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Log skin entry</h2>
        <SkinEntryForm onSaved={bumpRefresh} />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Log skincare change</h2>
        <SkincareChangeForm onSaved={bumpRefresh} />
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">History</h2>
        {entriesMostRecentFirst === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : entriesMostRecentFirst.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No skin entries logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entriesMostRecentFirst.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 text-sm last:border-b-0 dark:border-slate-800"
              >
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    {entry.date} · Severity {entry.acneSeverity}/4
                  </p>
                  {entry.breakoutAreas.length > 0 && (
                    <p className="text-slate-500 dark:text-slate-400">Areas: {entry.breakoutAreas.join(", ")}</p>
                  )}
                  {entry.lesionType && (
                    <p className="text-slate-500 dark:text-slate-400">Lesion type: {entry.lesionType}</p>
                  )}
                  {(entry.dryness != null || entry.irritation != null) && (
                    <p className="text-slate-500 dark:text-slate-400">
                      {entry.dryness != null ? `Dryness ${entry.dryness}/3` : ""}
                      {entry.dryness != null && entry.irritation != null ? " · " : ""}
                      {entry.irritation != null ? `Irritation ${entry.irritation}/3` : ""}
                    </p>
                  )}
                  {entry.skincareProductsUsed.length > 0 && (
                    <p className="text-slate-500 dark:text-slate-400">
                      Products: {entry.skincareProductsUsed.join(", ")}
                    </p>
                  )}
                  {entry.notes && <p className="text-slate-500 dark:text-slate-400">{entry.notes}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteEntry(entry.id)}
                  className="shrink-0 text-xs font-medium text-slate-400 hover:text-red-500"
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
