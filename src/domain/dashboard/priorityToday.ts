import type { ActivityType } from "../models/common";

export type NutrientLabel = "calories" | "protein" | "fiber" | "carbs" | "fat";

export interface NutrientProgress {
  label: NutrientLabel;
  targetAmount: number;
  consumedAmount: number;
}

export interface PriorityTodayInput {
  nutrients: NutrientProgress[];
  activityType: ActivityType;
}

export interface PriorityTodayResult {
  headline: string;
  sufficientLabels: NutrientLabel[];
  priorityLabels: NutrientLabel[];
}

const SUFFICIENT_REMAINING_FRACTION = 0.15;

const DISPLAY_NAME: Record<NutrientLabel, string> = {
  calories: "total energy",
  protein: "protein",
  fiber: "fiber",
  carbs: "carbohydrate",
  fat: "fat",
};

const ACTIVITY_NOTE: Record<ActivityType, string> = {
  lifting: "Today is a lifting day — protein and total energy matter most for recovery.",
  volleyball: "Today is a volleyball day — carbohydrate and total energy support performance and recovery.",
  recovery: "Today is a recovery day — fiber and steady energy support how you feel tomorrow.",
  rest: "Today is a rest day — no training demand is pushing any nutrient higher than usual.",
  other: "Log a meal to get a personalized priority for today.",
};

/**
 * The brief's own worked example: "Protein is sufficient; prioritize carbohydrate +
 * total energy." Ranks nutrient gaps by how far each sits from its target as a
 * FRACTION of target (not raw grams/kcal), so a 20g protein gap and a 20g fiber gap
 * are compared on the same footing rather than the biggest-unit nutrient always
 * winning.
 */
export function resolvePriorityToday(input: PriorityTodayInput): PriorityTodayResult {
  const withGaps = input.nutrients.map((n) => ({
    label: n.label,
    remainingFraction:
      n.targetAmount > 0 ? Math.max(0, (n.targetAmount - n.consumedAmount) / n.targetAmount) : 0,
  }));

  const sufficient = withGaps.filter((n) => n.remainingFraction <= SUFFICIENT_REMAINING_FRACTION);
  const priority = withGaps
    .filter((n) => n.remainingFraction > SUFFICIENT_REMAINING_FRACTION)
    .sort((a, b) => b.remainingFraction - a.remainingFraction);

  const sufficientLabels = sufficient.map((n) => n.label);
  const priorityLabels = priority.map((n) => n.label);

  return {
    headline: buildHeadline(sufficientLabels, priorityLabels, input.activityType),
    sufficientLabels,
    priorityLabels,
  };
}

function buildHeadline(
  sufficient: NutrientLabel[],
  priority: NutrientLabel[],
  activityType: ActivityType,
): string {
  if (priority.length === 0) {
    return sufficient.length > 0 ? "You're on track across the board today." : ACTIVITY_NOTE[activityType];
  }

  const priorityText = priority
    .slice(0, 2)
    .map((l) => DISPLAY_NAME[l])
    .join(" + ");
  const sufficientText =
    sufficient.length > 0
      ? `${sufficient.map((l) => DISPLAY_NAME[l]).join(", ")} ${sufficient.length === 1 ? "is" : "are"} sufficient; `
      : "";

  return `${capitalize(sufficientText)}prioritize ${priorityText}.`;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}
