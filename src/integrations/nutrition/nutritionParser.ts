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

// "with" is deliberately NOT a segment separator here — see splitSegmentOnWith/
// resolveModifierForMatching below for why it needs smarter handling than a plain split.
const SEGMENT_SPLIT_REGEX = /,| and |\+| plus |\n/gi;

/** Unmatched foods get a clearly-labeled, wide-range placeholder estimate — never a
 * fabricated precise number — per IMPLEMENTATION_PLAN.md's documented parser limits. */
const UNMATCHED_ESTIMATE = { calories: 250, calorieRangeLow: 100, calorieRangeHigh: 450 };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatQuantity(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, "");
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

/**
 * "X with Y" is ambiguous: "chicken with rice" is two separate dishes worth logging
 * separately, but "latte with whole milk" is ONE drink whose reference nutrition
 * already assumes a milk type — logging "whole milk" again on top would double-count
 * it. The distinguishing signal is already sitting in the data: if X's own
 * `servingDescription` already mentions Y (like the latte entry's "1 cup (240ml)
 * whole milk, 1 shot"), Y isn't a separate food to add, just a detail already priced
 * into X's number. If it doesn't (plain "coffee"'s description says nothing about
 * milk), treat "with" the same as "and": two foods.
 */
function findModifierBakedInMatch(base: string, modifier: string): FoodDatabaseEntry | null {
  const baseMatch = findFoodMatch(base);
  if (baseMatch && baseMatch.servingDescription.toLowerCase().includes(modifier.toLowerCase())) {
    return baseMatch;
  }
  return null;
}

/** Segment-level pass: decides whether a "with" clause splits into two segments or
 * stays as one (see findModifierBakedInMatch). Segments with no "with" pass through
 * untouched. */
function splitSegmentOnWith(segment: string): string[] {
  const match = segment.match(/^(.+?)\s+with\s+(.+)$/i);
  if (!match) return [segment];
  const base = match[1]!.trim();
  const modifier = match[2]!.trim();
  if (findModifierBakedInMatch(base, modifier)) {
    return [segment]; // keep whole — matched via the base, modifier kept in the name only
  }
  return [base, modifier]; // genuinely two foods, e.g. "chicken with rice"
}

/** Per-segment pass, for a segment that splitSegmentOnWith decided to keep whole:
 * separates the text to match against the food database (the base) from the text to
 * echo in the logged item's name (the modifier), so "latte with whole milk" matches
 * the latte entry but still reads "latte with whole milk" in your log. */
function resolveModifierForMatching(text: string): { matchText: string; modifierSuffix: string | null } {
  const match = text.match(/^(.+?)\s+with\s+(.+)$/i);
  if (!match) return { matchText: text, modifierSuffix: null };
  const base = match[1]!.trim();
  const modifier = match[2]!.trim();
  if (findModifierBakedInMatch(base, modifier)) {
    return { matchText: base, modifierSuffix: modifier };
  }
  return { matchText: text, modifierSuffix: null };
}

// --- Explicit unit quantities ("12 oz coffee", "200 g chicken") ---------------------

/** ml-per-unit for volume measures, used when a food's own reference serving is
 * volume-based (its servingDescription has a "(NNNml)" parenthetical). "oz" here
 * means fluid ounce, matching how people talk about drinks. */
const VOLUME_ML_PER_UNIT: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  cup: 236.588,
  cups: 236.588,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tablespoons: 14.7868,
  tsp: 4.92892,
  teaspoon: 4.92892,
  teaspoons: 4.92892,
  oz: 29.5735,
  "fl oz": 29.5735,
};

/** g-per-unit for weight measures, used when a food's own reference serving is
 * weight-based (its servingDescription has a "(NNNg)" parenthetical). "oz" here means
 * weight ounce, matching how people talk about solid food. */
const WEIGHT_G_PER_UNIT: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const UNIT_WORDS = [
  "fl oz",
  "oz",
  "ml",
  "milliliters",
  "milliliter",
  "l",
  "liters",
  "liter",
  "cups",
  "cup",
  "tbsp",
  "tablespoons",
  "tablespoon",
  "tsp",
  "teaspoons",
  "teaspoon",
  "g",
  "grams",
  "gram",
  "kg",
  "lb",
];

/** Recognizes a leading "<number> <unit>" — e.g. "12 oz coffee" → {amount:12,
 * unit:"oz", remainderText:"coffee"} — so that number is treated as a real measured
 * quantity, not a serving-count multiplier (see computeQuantityMultiplier). Only a
 * fixed set of measurement words count as a "unit"; anything else ("2 bananas") falls
 * through to the plain serving-count parsing in extractQuantity. */
function extractUnitQuantity(trimmed: string): { amount: number; unit: string; remainderText: string } | null {
  for (const unit of UNIT_WORDS) {
    const pattern = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${escapeRegExp(unit)}\\s+(.*)$`, "i");
    const match = trimmed.match(pattern);
    if (match) {
      return { amount: Number(match[1]), unit, remainderText: match[2]! };
    }
  }
  return null;
}

/** Pulls the reference amount out of a servingDescription — the authoritative
 * real-world quantity behind that food's standard serving. Most entries carry it
 * parenthetically ("1 medium (118g)"); a few ("100g cooked") state it plainly up
 * front instead, so both forms are checked. */
function parseReferenceQuantity(servingDescription: string): { amount: number; unit: "ml" | "g" } | null {
  const parenMatch = servingDescription.match(/\((\d+(?:\.\d+)?)\s*(ml|g)\)/);
  if (parenMatch) {
    return { amount: Number(parenMatch[1]), unit: parenMatch[2] as "ml" | "g" };
  }
  const leadingMatch = servingDescription.match(/^(\d+(?:\.\d+)?)\s*(ml|g)\b/);
  if (leadingMatch) {
    return { amount: Number(leadingMatch[1]), unit: leadingMatch[2] as "ml" | "g" };
  }
  return null;
}

/** Converts a user-typed amount+unit into a portion multiplier relative to the
 * matched food's own reference serving, so "12 oz coffee" scales correctly against
 * coffee's "1 cup (240ml)" reference instead of being read as "12 servings." Falls
 * back to treating the amount as a plain serving-count multiplier when the food has
 * no parenthetical reference, or the typed unit isn't in the same dimension (volume
 * vs. weight) as that reference — never a hard error, just a safe default. */
function computeQuantityMultiplier(amount: number, unit: string, entry: FoodDatabaseEntry): number {
  const reference = parseReferenceQuantity(entry.servingDescription);
  if (!reference) return amount;

  const table = reference.unit === "ml" ? VOLUME_ML_PER_UNIT : WEIGHT_G_PER_UNIT;
  const perUnit = table[unit.toLowerCase()];
  if (perUnit == null) return amount;

  return (amount * perUnit) / reference.amount;
}

// --- Quantity extraction -------------------------------------------------------------

function extractQuantity(segment: string): { quantity: number; unit: string | null; remainderText: string } {
  const trimmed = segment.trim();

  const unitMatch = extractUnitQuantity(trimmed);
  if (unitMatch) {
    return { quantity: unitMatch.amount, unit: unitMatch.unit, remainderText: unitMatch.remainderText };
  }

  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)\s+(.*)$/);
  if (fractionMatch) {
    return {
      quantity: Number(fractionMatch[1]) / Number(fractionMatch[2]),
      unit: null,
      remainderText: fractionMatch[3]!,
    };
  }

  const digitMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.*)$/);
  if (digitMatch) {
    return { quantity: Number(digitMatch[1]), unit: null, remainderText: digitMatch[2]! };
  }

  const wordMatch = trimmed.match(/^([a-z]+)\s+(.*)$/i);
  if (wordMatch) {
    const wordQuantity = NUMBER_WORDS[wordMatch[1]!.toLowerCase()];
    if (wordQuantity != null) {
      return { quantity: wordQuantity, unit: null, remainderText: wordMatch[2]! };
    }
  }

  return { quantity: 1, unit: null, remainderText: trimmed };
}

/** Derives a human-readable serving label from a food's own servingDescription (e.g.
 * "1 cup cooked (158g)" → "1 cup cooked", "100g cooked" → "100g cooked", "1 large
 * (50g)" → "1 large") — used so a bare food name with no typed quantity still shows
 * SOME portion descriptor instead of none at all. Stops at the first parenthetical or
 * comma, since those introduce secondary detail ("(158g)", ", 85% lean") not needed
 * in a short label. */
function describeStandardServing(servingDescription: string): string {
  const parenIndex = servingDescription.indexOf("(");
  if (parenIndex >= 0) return servingDescription.slice(0, parenIndex).trim();
  const commaIndex = servingDescription.indexOf(",");
  if (commaIndex >= 0) return servingDescription.slice(0, commaIndex).trim();
  return servingDescription.trim();
}

/** Combines a serving/quantity label with the food's name, e.g. "1 cup cooked" +
 * "white rice" → "1 cup cooked white rice". If the label's last word already appears
 * in the name (e.g. label "1 bean-and-cheese burrito" + name "burrito", or label
 * "1 deli sandwich" + name "turkey sandwich"), that trailing word is dropped from the
 * label first so the result doesn't repeat itself ("1 bean-and-cheese burrito", not
 * "1 bean-and-cheese burrito burrito"). */
function combineLabelAndName(label: string, name: string): string {
  const labelWords = label.split(" ");
  const lastWord = labelWords[labelWords.length - 1]!.toLowerCase();
  const nameWords = name.toLowerCase().split(" ");
  if (nameWords.includes(lastWord)) {
    const trimmedLabel = labelWords.slice(0, -1).join(" ").trim();
    return trimmedLabel ? `${trimmedLabel} ${name}` : name;
  }
  return `${label} ${name}`;
}

function parseOneSegment(segment: string): ParsedFoodItem {  const { quantity, unit, remainderText } = extractQuantity(segment);
  const { matchText, modifierSuffix } = resolveModifierForMatching(remainderText);
  const match = findFoodMatch(matchText);

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

  const multiplier = unit ? computeQuantityMultiplier(quantity, unit, match) : quantity;
  // Single-ingredient foods (chicken breast, an apple) vary little from the USDA
  // reference value, so they get a tight range; composite/branded foods (a burrito,
  // a protein bar) vary a lot by recipe/brand, so they get a wider one.
  const rangeWidth = match.confidence === "high" ? 0.08 : 0.2;

  // Echo the real unit the user typed ("12 oz coffee") rather than a bare portion
  // count, keep the plain-count style ("2 banana") when a count was given but no
  // unit, and otherwise (nothing typed at all — just "salmon") fall back to the
  // food's own standard serving ("100g cooked salmon") rather than showing no
  // portion descriptor whatsoever.
  const quantityLabel = unit
    ? `${formatQuantity(quantity)} ${unit}`
    : quantity !== 1
      ? formatQuantity(quantity)
      : describeStandardServing(match.servingDescription);
  const baseName = combineLabelAndName(quantityLabel, match.name);
  const name = modifierSuffix ? `${baseName} with ${modifierSuffix}` : baseName;

  return {
    name,
    calories: round(match.calories * multiplier),
    calorieRangeLow: round(match.calories * multiplier * (1 - rangeWidth)),
    calorieRangeHigh: round(match.calories * multiplier * (1 + rangeWidth)),
    proteinG: round(match.proteinG * multiplier),
    carbsG: round(match.carbsG * multiplier),
    fatG: round(match.fatG * multiplier),
    fiberG: round(match.fiberG * multiplier),
    addedSugarG: match.addedSugarG != null ? round(match.addedSugarG * multiplier) : null,
    totalSugarG: match.totalSugarG != null ? round(match.totalSugarG * multiplier) : null,
    caffeineMg: match.caffeineMg != null ? round(match.caffeineMg * multiplier) : null,
    confidence: match.confidence,
  };
}

/**
 * On-device heuristic parser — no network call, no LLM, per the user's "rule-based
 * only" choice. Splits free text into segments, extracts a leading quantity (a plain
 * count or a real measured unit), and matches the remainder against a small local
 * food list (foodDatabase.ts). A segment that matches nothing gets a low-confidence
 * placeholder rather than a fabricated precise number — a real, if simple, working
 * parser (not a stub), same approach as health-tracker's MockNutritionProvider.
 */
export function parseNutritionText(rawText: string): ParsedFoodItem[] {
  const segments = rawText
    .split(SEGMENT_SPLIT_REGEX)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .flatMap((segment) => splitSegmentOnWith(segment));

  return segments.map((segment) => parseOneSegment(segment));
}
