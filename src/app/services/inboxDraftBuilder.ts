import { v4 as uuid } from "uuid";
import { toIsoDate } from "../../domain/dateUtils";
import { parseNutritionText } from "../../integrations/nutrition/nutritionParser";
import type { InboxSegment } from "../../integrations/inbox/inboxParser";
import type { Workout } from "../../storage/schemas/workout";
import type { ParsedFoodItem } from "../../storage/schemas/nutrition";
import type { SymptomEntry } from "../../storage/schemas/symptomAndRun";
import type { MenstrualCycleEntry } from "../../storage/schemas/cycle";

export type InboxDraft =
  | { kind: "food"; rawText: string; items: ParsedFoodItem[] }
  | { kind: "workout"; workout: Workout }
  | { kind: "symptom"; symptom: SymptomEntry }
  | { kind: "cycle"; entry: MenstrualCycleEntry }
  | { kind: "unclassified"; text: string };

const WORKOUT_DURATION_REGEX = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min)\b/i;

/** Extracts a workout duration in minutes from free text like "2.5 hours",
 * "90 minutes", or "1 hr" — hours are converted to minutes; defaults to 30 when no
 * duration phrase is found rather than leaving the field empty. */
function extractDurationMinutes(text: string): number {
  const match = text.match(WORKOUT_DURATION_REGEX);
  if (!match) return 30;
  const value = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const isHours = unit.startsWith("h");
  return Math.round(isHours ? value * 60 : value);
}

const STRENGTH_KEYWORDS = ["lift", "gym", "bench", "squat", "deadlift"];
const RUN_KEYWORDS = ["run", "ran", "jog"];

function guessWorkoutType(text: string): Workout["workoutType"] {
  const lower = text.toLowerCase();
  if (lower.includes("volleyball")) return "volleyball";
  if (STRENGTH_KEYWORDS.some((k) => lower.includes(k))) return "strength";
  if (RUN_KEYWORDS.some((k) => lower.includes(k))) return "run";
  return "other";
}

const BODY_AREA_KEYWORDS = [
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

function guessBodyArea(text: string): string {
  const lower = text.toLowerCase();
  return BODY_AREA_KEYWORDS.find((area) => lower.includes(area)) ?? "unspecified";
}

function guessSymptomType(text: string): SymptomEntry["symptomType"] {
  const lower = text.toLowerCase();
  if (lower.includes("tight")) return "tightness";
  if (lower.includes("sore")) return "soreness";
  if (lower.includes("numb")) return "numbness";
  if (lower.includes("pain") || lower.includes("hurt")) return "pain";
  return "other";
}

function guessBleeding(text: string): MenstrualCycleEntry["bleeding"] {
  const lower = text.toLowerCase();
  if (lower.includes("heavy")) return "heavy";
  if (lower.includes("light")) return "light";
  return "medium";
}

function buildFoodDraft(segment: InboxSegment): InboxDraft {
  return { kind: "food", rawText: segment.text, items: parseNutritionText(segment.text) };
}

function buildWorkoutDraft(segment: InboxSegment): InboxDraft {
  const workout: Workout = {
    id: uuid(),
    source: "manual",
    sourceWorkoutId: null,
    workoutType: guessWorkoutType(segment.text),
    startTime: new Date().toISOString(),
    endTime: null,
    durationMinutes: extractDurationMinutes(segment.text),
    activeCaloriesKcal: null,
    totalCaloriesKcal: null,
    averageHeartRate: null,
    maxHeartRate: null,
    hrZones: null,
    perceivedExertion: null,
    notes: segment.text,
  };
  return { kind: "workout", workout };
}

function buildSymptomDraft(segment: InboxSegment): InboxDraft {
  const symptom: SymptomEntry = {
    id: uuid(),
    dateTime: new Date().toISOString(),
    bodyArea: guessBodyArea(segment.text),
    symptomType: guessSymptomType(segment.text),
    severity: 5,
    laterality: "n/a",
    trigger: null,
    durationMinutes: null,
    impactOnTraining: null,
    notes: segment.text,
    flaggedForReview: false,
  };
  return { kind: "symptom", symptom };
}

function buildCycleDraft(segment: InboxSegment): InboxDraft {
  const lower = segment.text.toLowerCase();
  const entry: MenstrualCycleEntry = {
    id: uuid(),
    date: toIsoDate(new Date()),
    bleeding: guessBleeding(segment.text),
    periodStart: lower.includes("started") || lower.includes("start"),
    periodEnd: false,
    cramps: null,
    breastTenderness: null,
    bloating: null,
    headache: null,
    fatigue: null,
    mood: null,
    irritability: null,
    cravings: null,
    hunger: null,
    sleepDisruption: null,
    giSymptoms: null,
    acneFlare: null,
    libido: null,
    cervicalMucus: null,
    ovulationTestResult: null,
    basalBodyTempF: null,
    notes: segment.text,
  };
  return { kind: "cycle", entry };
}

/**
 * Turns classified inbox segments into per-domain drafts, pure and side-effect-free —
 * no repository writes happen here. The screen layer shows every draft on one
 * confirmation view and only persists them once the user explicitly confirms
 * (brief's "never auto-commit a multi-domain parse" rule).
 */
export function buildDraftsFromSegments(segments: InboxSegment[]): InboxDraft[] {
  return segments.map((segment): InboxDraft => {
    switch (segment.domain) {
      case "food":
        return buildFoodDraft(segment);
      case "workout":
        return buildWorkoutDraft(segment);
      case "symptom":
        return buildSymptomDraft(segment);
      case "cycle":
        return buildCycleDraft(segment);
      default:
        return { kind: "unclassified", text: segment.text };
    }
  });
}
