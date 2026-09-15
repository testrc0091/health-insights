import { FOOD_DATABASE, type FoodDatabaseEntry } from "./foodDatabase";
import type { ParsedFoodItem } from "../../storage/schemas/nutrition";

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
  couple: 2,
  few: 3,
};

const SEGMENT_SPLIT_REGEX = /,| and |\+| with | plus |\n/gi;

/** Unmatched foods get a clearly-labeled, wide-range placeholder estimate — never a
 * fabricated precise number — per IMPLEMENTATION_PLAN.md's documented parser limits. */
const UNMATCHED_ESTIMATE = { calories: 250, calorieRangeLow: 100, calorieRangeHigh: 450 };

function extractQuantity(segment: string): { quantity: number; remainderText: string } {
  const trimmed = segment.trim();

  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)\s+(.*)$/);
  if (fractionMatch) {
    return { quantity: Number(fractionMatch[1]) / Number(fractionMatch[2]), remainderText: fractionMatch[3]! };
  }

  const digitMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.*)$/);
  if (digitMatch) {
    return { quantity: Number(digitMatch[1]), remainderText: digitMatch[2]! };
  }

  const wordMatch = trimmed.match(/^([a-z]+)\s+(.*)$/i);
  if (wordMatch) {
    const wordQuantity = NUMBER_WORDS[wordMatch[1]!.toLowerCase()];
    if (wordQuantity != null) {
      return { quantity: wordQuantity, remainderText: wordMatch[2]! };
    }
  }

  return { quantity: 1, remainderText: trimmed };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFoodMatch(text: string): FoodDatabaseEntry | null {
  const normalized = text.toLowerCase().trim();
  const candidates = FOOD_DATABASE.flatMap((entry) => entry.aliases.map((alias) => ({ entry, alias })));
  // Longest alias first, so a more specific multi-word alias (e.g. "greek yogurt")
  // wins over a shorter one ("yogurt") that would otherwise match the same text.
  candidates.sort((a, b) => b.alias.length - a.alias.length);
  for (const { entry, alias } of candidates) {
    // Whole-word match, not a bare substring check — otherwise short aliases false-
    // match inside unrelated words ("tea" inside "steak"/"steamed", "corn" inside
    // "popcorn", "egg" inside "eggplant"). A trailing e?s? tolerates common English
    // plurals ("banana"/"bananas", "tomato"/"tomatoes") without listing every one as
    // a separate alias.
    const pattern = new RegExp(`\\b${escapeRegExp(alias)}e?s?\\b`, "i");
    if (pattern.test(normalized)) return entry;
  }
  return null;
}

function formatQuantity(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, "");
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * On-device heuristic parser — no network call, no LLM, per the user's "rule-based
 * only" choice. Splits free text into segments, extracts a leading quantity, and
 * matches the remainder against a small local food list (foodDatabase.ts). A segment
 * that matches nothing gets a low-confidence placeholder rather than a fabricated
 * precise number — a real, if simple, working parser (not a stub), same approach as
 * health-tracker's MockNutritionProvider.
 */
export function parseNutritionText(rawText: string): ParsedFoodItem[] {
  const segments = rawText
    .split(SEGMENT_SPLIT_REGEX)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return segments.map((segment): ParsedFoodItem => {
    const { quantity, remainderText } = extractQuantity(segment);
    const match = findFoodMatch(remainderText);

    if (!match) {
      return {
        name: segment,
        calories: round(UNMATCHED_ESTIMATE.calories * quantity),
        calorieRangeLow: round(UNMATCHED_ESTIMATE.calorieRangeLow * quantity),
        calorieRangeHigh: round(UNMATCHED_ESTIMATE.calorieRangeHigh * quantity),
        proteinG: 0,
        carbsG: null,
        fatG: null,
        fiberG: 0,
        addedSugarG: null,
        totalSugarG: null,
        caffeineMg: null,
        confidence: "low",
      };
    }

      // Single-ingredient foods (chicken breast, an apple) vary little from the USDA
    // reference value, so they get a tight range; composite/branded foods (a
    // burrito, a protein bar) vary a lot by recipe/brand, so they get a wider one —
    // and the item's own confidence tier reflects that difference, not a flat
    // "medium" for every database match regardless of how reliable it actually is.
    const rangeWidth = match.confidence === "high" ? 0.08 : 0.2;
    return {
      name: quantity === 1 ? match.name : `${formatQuantity(quantity)} ${match.name}`,
      calories: round(match.calories * quantity),
      calorieRangeLow: round(match.calories * quantity * (1 - rangeWidth)),
      calorieRangeHigh: round(match.calories * quantity * (1 + rangeWidth)),
      proteinG: round(match.proteinG * quantity),
      carbsG: round(match.carbsG * quantity),
      fatG: round(match.fatG * quantity),
      fiberG: round(match.fiberG * quantity),
      addedSugarG: match.addedSugarG != null ? round(match.addedSugarG * quantity) : null,
      totalSugarG: match.totalSugarG != null ? round(match.totalSugarG * quantity) : null,
      caffeineMg: match.caffeineMg != null ? round(match.caffeineMg * quantity) : null,
      confidence: match.confidence,
    };
  });
}
