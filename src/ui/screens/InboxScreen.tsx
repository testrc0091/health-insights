import { useState } from "react";
import { v4 as uuid } from "uuid";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { toIsoDate } from "../../domain/dateUtils";
import { splitInboxText } from "../../integrations/inbox/inboxParser";
import { buildDraftsFromSegments, type InboxDraft } from "../../app/services/inboxDraftBuilder";
import {
  foodEntryRepository,
  workoutRepository,
  symptomEntryRepository,
  menstrualCycleEntryRepository,
} from "../../storage/repositories";
import { recomputeCycles } from "../../app/services/cycleService";
import type { ParsedFoodItem } from "../../storage/schemas/nutrition";
import type { Workout } from "../../storage/schemas/workout";
import type { SymptomEntry } from "../../storage/schemas/symptomAndRun";
import type { MenstrualCycleEntry } from "../../storage/schemas/cycle";

type EditableNumberField = "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG";

const WORKOUT_TYPE_OPTIONS: Workout["workoutType"][] = ["strength", "volleyball", "run", "other"];
const SYMPTOM_TYPE_OPTIONS: SymptomEntry["symptomType"][] = [
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
const BLEEDING_OPTIONS: MenstrualCycleEntry["bleeding"][] = ["none", "spotting", "light", "medium", "heavy"];

const inputClass =
  "rounded border border-slate-200 bg-transparent px-2 py-1 text-sm focus:border-accent focus:outline-none dark:border-slate-700";

export function InboxScreen() {
  const [inboxText, setInboxText] = useState("");
  const [drafts, setDrafts] = useState<InboxDraft[] | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function handleParse() {
    const text = inboxText.trim();
    if (!text) return;
    const segments = splitInboxText(text);
    setDrafts(buildDraftsFromSegments(segments));
    setSavedMessage(null);
  }

  function handleDiscardDrafts() {
    setDrafts(null);
  }

  function updateFoodItem(draftIndex: number, itemIndex: number, field: EditableNumberField, value: number) {
    setDrafts((prev) => {
      if (!prev) return prev;
      return prev.map((d, i) => {
        if (i !== draftIndex || d.kind !== "food") return d;
        const items = d.items.map((item, j) => (j === itemIndex ? { ...item, [field]: value } : item));
        return { ...d, items };
      });
    });
  }

  function updateWorkoutDraft(draftIndex: number, patch: Partial<Workout>) {
    setDrafts((prev) => {
      if (!prev) return prev;
      return prev.map((d, i) => (i === draftIndex && d.kind === "workout" ? { ...d, workout: { ...d.workout, ...patch } } : d));
    });
  }

  function updateSymptomDraft(draftIndex: number, patch: Partial<SymptomEntry>) {
    setDrafts((prev) => {
      if (!prev) return prev;
      return prev.map((d, i) => (i === draftIndex && d.kind === "symptom" ? { ...d, symptom: { ...d.symptom, ...patch } } : d));
    });
  }

  function updateCycleDraft(draftIndex: number, patch: Partial<MenstrualCycleEntry>) {
    setDrafts((prev) => {
      if (!prev) return prev;
      return prev.map((d, i) => (i === draftIndex && d.kind === "cycle" ? { ...d, entry: { ...d.entry, ...patch } } : d));
    });
  }

  async function handleConfirmSaveAll() {
    if (!drafts || drafts.length === 0) return;
    let savedCount = 0;
    let wroteCycleEntry = false;

    for (const draft of drafts) {
      if (draft.kind === "food") {
        const now = new Date();
        await foodEntryRepository.put({
          id: uuid(),
          timestamp: now.toISOString(),
          date: toIsoDate(now),
          rawText: draft.rawText,
          parsedFoods: draft.items,
          source: "manual",
          notes: null,
        });
        savedCount++;
      } else if (draft.kind === "workout") {
        await workoutRepository.put(draft.workout);
        savedCount++;
      } else if (draft.kind === "symptom") {
        await symptomEntryRepository.put(draft.symptom);
        savedCount++;
      } else if (draft.kind === "cycle") {
        await menstrualCycleEntryRepository.put(draft.entry);
        wroteCycleEntry = true;
        savedCount++;
      }
      // "unclassified" drafts are never saved — surfaced read-only below instead.
    }

    if (wroteCycleEntry) await recomputeCycles();

    setDrafts(null);
    setInboxText("");
    setSavedMessage(`Saved ${savedCount} item${savedCount === 1 ? "" : "s"}`);
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="Inbox" subtitle="Tell me what's going on — I'll sort it out" />

      <Card>
        <textarea
          className="w-full rounded-lg border border-slate-200 bg-transparent p-2 text-sm text-slate-800 focus:border-accent focus:outline-none dark:border-slate-700 dark:text-slate-100"
          rows={4}
          placeholder="e.g. Had 2 eggs and toast, played volleyball for 2 hours, my hip feels tight, period started"
          value={inboxText}
          onChange={(e) => setInboxText(e.target.value)}
        />
        <div className="mt-2 flex justify-end gap-2">
          {drafts && (
            <button
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
              onClick={handleDiscardDrafts}
            >
              Discard
            </button>
          )}
          <button
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            onClick={handleParse}
            disabled={inboxText.trim().length === 0}
          >
            Parse
          </button>
        </div>
      </Card>

      {savedMessage && (
        <Card>
          <p className="text-sm font-medium text-accent">{savedMessage}</p>
        </Card>
      )}

      {drafts && drafts.length > 0 && (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nothing is saved yet — review each item below, then confirm.
          </p>

          {drafts.map((draft, index) => (
            <Card key={index}>
              {draft.kind === "food" && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Food</p>
                  <div className="flex flex-col gap-2">
                    {draft.items.map((item, itemIndex) => (
                      <FoodDraftItemEditor
                        key={itemIndex}
                        item={item}
                        onChange={(field, value) => updateFoodItem(index, itemIndex, field, value)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {draft.kind === "workout" && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Workout</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <label className="flex flex-col gap-0.5">
                      Type
                      <select
                        className={inputClass}
                        value={draft.workout.workoutType}
                        onChange={(e) =>
                          updateWorkoutDraft(index, { workoutType: e.target.value as Workout["workoutType"] })
                        }
                      >
                        {WORKOUT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5">
                      Duration (min)
                      <input
                        type="number"
                        className={inputClass}
                        value={draft.workout.durationMinutes}
                        onChange={(e) => updateWorkoutDraft(index, { durationMinutes: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <label className="mt-2 flex flex-col gap-0.5 text-sm">
                    Notes
                    <textarea
                      className={`${inputClass} w-full`}
                      rows={2}
                      value={draft.workout.notes ?? ""}
                      onChange={(e) => updateWorkoutDraft(index, { notes: e.target.value })}
                    />
                  </label>
                </div>
              )}

              {draft.kind === "symptom" && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Symptom</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <label className="flex flex-col gap-0.5">
                      Body area
                      <input
                        type="text"
                        className={inputClass}
                        value={draft.symptom.bodyArea}
                        onChange={(e) => updateSymptomDraft(index, { bodyArea: e.target.value })}
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      Type
                      <select
                        className={inputClass}
                        value={draft.symptom.symptomType}
                        onChange={(e) =>
                          updateSymptomDraft(index, { symptomType: e.target.value as SymptomEntry["symptomType"] })
                        }
                      >
                        {SYMPTOM_TYPE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5">
                      Severity (0-10)
                      <input
                        type="number"
                        min={0}
                        max={10}
                        className={inputClass}
                        value={draft.symptom.severity}
                        onChange={(e) => updateSymptomDraft(index, { severity: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <label className="mt-2 flex flex-col gap-0.5 text-sm">
                    Notes
                    <textarea
                      className={`${inputClass} w-full`}
                      rows={2}
                      value={draft.symptom.notes ?? ""}
                      onChange={(e) => updateSymptomDraft(index, { notes: e.target.value })}
                    />
                  </label>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    If this keeps up, consider a clinical check-in.
                  </p>
                </div>
              )}

              {draft.kind === "cycle" && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Cycle</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <label className="flex flex-col gap-0.5">
                      Date
                      <input
                        type="date"
                        className={inputClass}
                        value={draft.entry.date}
                        onChange={(e) => updateCycleDraft(index, { date: e.target.value })}
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      Bleeding
                      <select
                        className={inputClass}
                        value={draft.entry.bleeding}
                        onChange={(e) =>
                          updateCycleDraft(index, { bleeding: e.target.value as MenstrualCycleEntry["bleeding"] })
                        }
                      >
                        {BLEEDING_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={draft.entry.periodStart}
                        onChange={(e) => updateCycleDraft(index, { periodStart: e.target.checked })}
                      />
                      Period start
                    </label>
                  </div>
                  <label className="mt-2 flex flex-col gap-0.5 text-sm">
                    Notes
                    <textarea
                      className={`${inputClass} w-full`}
                      rows={2}
                      value={draft.entry.notes ?? ""}
                      onChange={(e) => updateCycleDraft(index, { notes: e.target.value })}
                    />
                  </label>
                </div>
              )}

              {draft.kind === "unclassified" && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Unclassified</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{draft.text}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Couldn't classify this — please log it manually on the right screen.
                  </p>
                </div>
              )}
            </Card>
          ))}

          <button
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
            onClick={handleConfirmSaveAll}
          >
            Confirm &amp; save all
          </button>
        </>
      )}
    </div>
  );
}

function FoodDraftItemEditor({
  item,
  onChange,
}: {
  item: ParsedFoodItem;
  onChange: (field: EditableNumberField, value: number) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.name}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {item.confidence} confidence
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-5">
        <label className="flex flex-col gap-0.5">
          Calories
          <input
            type="number"
            className={inputClass}
            value={item.calories}
            onChange={(e) => onChange("calories", Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Protein (g)
          <input
            type="number"
            className={inputClass}
            value={item.proteinG}
            onChange={(e) => onChange("proteinG", Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Carbs (g)
          <input
            type="number"
            className={inputClass}
            value={item.carbsG ?? 0}
            onChange={(e) => onChange("carbsG", Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Fat (g)
          <input
            type="number"
            className={inputClass}
            value={item.fatG ?? 0}
            onChange={(e) => onChange("fatG", Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Fiber (g)
          <input
            type="number"
            className={inputClass}
            value={item.fiberG}
            onChange={(e) => onChange("fiberG", Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
