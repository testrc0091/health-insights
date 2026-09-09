import { confidenceFromSampleSize } from "../insights/confidenceThresholds";
import type { ConfidenceTier } from "../models/common";

export interface VolleyballModelInput {
  durationMinutes: number;
  averageHeartRate: number | null;
  restingHeartRate: number | null;
  observedMaxHeartRate: number | null;
  /** How many prior volleyball sessions have already fed this model — the range
   * narrows and confidence rises as this grows, using the same sessions-based
   * thresholds as the rest of the insights engine (brief: "use number of sessions
   * rather than cycles" for workout-linked estimates). */
  priorSessionsCount: number;
}

export interface VolleyballCalorieEstimate {
  estimateKcal: number;
  rangeLowKcal: number;
  rangeHighKcal: number;
  confidence: ConfidenceTier;
  kcalPerHour: number;
}

/** Midpoint of the brief's stated personal prior: "roughly 400-450 active kcal/hour." */
const BASE_KCAL_PER_HOUR = 425;

/**
 * Starts from the brief's stated prior and nudges it up/down by how hard THIS session
 * was relative to a baseline assumed effort (~75% heart-rate reserve), when HR data is
 * available; otherwise uses the flat prior. This is a genuinely simple starting model
 * — it does not yet regress against the user's own historical Apple-vs-actual data,
 * which is the real calibration step described in IMPLEMENTATION_PLAN.md Phase 2 (it
 * requires enough logged sessions to fit against). Never presented as exact — always
 * returns a range and an explicit confidence tier.
 */
export function estimateVolleyballCalories(input: VolleyballModelInput): VolleyballCalorieEstimate {
  const hours = input.durationMinutes / 60;
  const hrrFraction = heartRateReserveFraction(input);

  // No HR data -> use the flat prior (multiplier 1). With HR data, scale from 0.7x
  // (very light effort) to 1.3x (near-max effort) around the baseline assumption.
  const effortMultiplier = hrrFraction === null ? 1 : 0.7 + 0.6 * hrrFraction;
  const kcalPerHour = BASE_KCAL_PER_HOUR * effortMultiplier;
  const estimateKcal = kcalPerHour * hours;

  // Range narrows as more sessions have been observed: 20% wide at zero history,
  // floored at 5% so the model never claims false precision even with lots of data.
  const rangeWidthFraction = Math.max(0.05, 0.2 - input.priorSessionsCount * 0.02);

  return {
    estimateKcal,
    rangeLowKcal: estimateKcal * (1 - rangeWidthFraction),
    rangeHighKcal: estimateKcal * (1 + rangeWidthFraction),
    confidence: confidenceFromSampleSize({ count: input.priorSessionsCount, isConsistent: true }),
    kcalPerHour,
  };
}

function heartRateReserveFraction(input: VolleyballModelInput): number | null {
  if (input.averageHeartRate == null || input.restingHeartRate == null || input.observedMaxHeartRate == null) {
    return null;
  }
  const reserve = input.observedMaxHeartRate - input.restingHeartRate;
  if (reserve <= 0) return null;
  return Math.min(1, Math.max(0, (input.averageHeartRate - input.restingHeartRate) / reserve));
}
