import { confidenceFromSampleSize } from "../confidenceThresholds";
import { average } from "../statHelpers";
import type { DraftInsight } from "../types";
import type { ISODate } from "../../models/common";

export type NutritionAdherenceLabel = "calories" | "protein" | "fiber" | "carbs" | "fat";

export interface NutritionAdherenceRecord {
  date: ISODate;
  label: NutritionAdherenceLabel;
  targetAmount: number;
  consumedAmount: number;
}

const MIN_DAYS = 5;
const UNDER_THRESHOLD = 0.85;
const OVER_THRESHOLD = 1.15;
const CONSISTENCY_FRACTION = 0.7;

/** Observes a consistent pattern of under- or over-hitting one nutrient's target over
 * a rolling window — not a single bad day, a repeated one. Feeds the Today "priority"
 * card and Trends nutrition charts. */
export function analyzeNutritionAdherence(
  records: NutritionAdherenceRecord[],
  label: NutritionAdherenceLabel,
): DraftInsight | null {
  const forLabel = records.filter((r) => r.label === label && r.targetAmount > 0);
  if (forLabel.length < MIN_DAYS) return null;

  const adherenceRatios = forLabel.map((r) => r.consumedAmount / r.targetAmount);
  const meanAdherence = average(adherenceRatios);
  const fractionUnder = adherenceRatios.filter((r) => r < UNDER_THRESHOLD).length / adherenceRatios.length;
  const fractionOver = adherenceRatios.filter((r) => r > OVER_THRESHOLD).length / adherenceRatios.length;
  const isConsistentlyUnder = fractionUnder >= CONSISTENCY_FRACTION;
  const isConsistentlyOver = fractionOver >= CONSISTENCY_FRACTION;
  const confidence = confidenceFromSampleSize({
    count: forLabel.length,
    isConsistent: isConsistentlyUnder || isConsistentlyOver,
  });
  const pct = (meanAdherence * 100).toFixed(0);

  const text = isConsistentlyUnder
    ? `Over the last ${forLabel.length} days, you've averaged ${pct}% of your ${label} target — consistently under.`
    : isConsistentlyOver
      ? `Over the last ${forLabel.length} days, you've averaged ${pct}% of your ${label} target — consistently over.`
      : `Your ${label} intake over the last ${forLabel.length} days has averaged ${pct}% of target, without a consistent pattern.`;

  return {
    kind: "observation",
    text,
    domain: "nutrition",
    confidence,
    sampleSize: { days: forLabel.length },
    effectSize: meanAdherence - 1,
    relatedEntityIds: [],
    generatedAt: new Date().toISOString(),
    algorithmVersion: "nutrition-adherence.v1",
  };
}
