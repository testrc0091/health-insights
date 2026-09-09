export type WeightGoalDirection = "gain" | "lose" | "maintain";

export interface CalibrationInput {
  goalDirection: WeightGoalDirection;
  /** Weekly average body weight (lb), oldest first. Brief: "if 3-4 week weight trend
   * is not moving toward the goal, propose a small adjustment." */
  weeklyAvgWeightLb: number[];
  estimatedTarget: number;
}

export interface CalibrationResult {
  recommendedAdjustmentKcal: number; // 0 = no change recommended
  calibratedTarget: number;
  reason: string;
}

const MIN_WEEKS_FOR_CALIBRATION = 3;
/** Midpoint of the brief's explicit "100-150 kcal/day" adjustment range. */
const ADJUSTMENT_STEP_KCAL = 125;
/** Below this weekly-average change (lb) over the window, the trend counts as "flat"
 * rather than as movement toward/away from the goal — avoids reacting to noise. */
const FLAT_TREND_THRESHOLD_LB = 0.5;

/**
 * Never silently overwrites the estimated target — returns both the estimated value
 * (as passed in) and a proposed calibrated value, so the UI can show "estimated
 * target" vs "calibrated target" side by side per the brief, and the user decides
 * whether to accept the calibration.
 */
export function calibrateCalorieTarget(input: CalibrationInput): CalibrationResult {
  const weeks = input.weeklyAvgWeightLb;

  if (weeks.length < MIN_WEEKS_FOR_CALIBRATION) {
    return {
      recommendedAdjustmentKcal: 0,
      calibratedTarget: input.estimatedTarget,
      reason: `Need at least ${MIN_WEEKS_FOR_CALIBRATION} weeks of weight data to calibrate (have ${weeks.length}).`,
    };
  }

  const change = weeks[weeks.length - 1]! - weeks[0]!;

  if (input.goalDirection === "maintain") {
    if (Math.abs(change) < FLAT_TREND_THRESHOLD_LB) {
      return { recommendedAdjustmentKcal: 0, calibratedTarget: input.estimatedTarget, reason: "Weight is stable; no adjustment needed." };
    }
    const adjustment = change > 0 ? -ADJUSTMENT_STEP_KCAL : ADJUSTMENT_STEP_KCAL;
    return {
      recommendedAdjustmentKcal: adjustment,
      calibratedTarget: input.estimatedTarget + adjustment,
      reason: `Weight has ${change > 0 ? "risen" : "fallen"} ${Math.abs(change).toFixed(1)} lb over ${weeks.length} weeks while aiming to maintain; suggesting a ${adjustment} kcal/day adjustment.`,
    };
  }

  const wantsGain = input.goalDirection === "gain";
  const isMovingTowardGoal = wantsGain ? change >= FLAT_TREND_THRESHOLD_LB : change <= -FLAT_TREND_THRESHOLD_LB;

  if (isMovingTowardGoal) {
    return {
      recommendedAdjustmentKcal: 0,
      calibratedTarget: input.estimatedTarget,
      reason: `Weight trend (${change >= 0 ? "+" : ""}${change.toFixed(1)} lb over ${weeks.length} weeks) is moving toward your ${input.goalDirection} goal; no adjustment needed.`,
    };
  }

  const adjustment = wantsGain ? ADJUSTMENT_STEP_KCAL : -ADJUSTMENT_STEP_KCAL;
  return {
    recommendedAdjustmentKcal: adjustment,
    calibratedTarget: input.estimatedTarget + adjustment,
    reason: `Weight trend (${change >= 0 ? "+" : ""}${change.toFixed(1)} lb over ${weeks.length} weeks) is not moving toward your ${input.goalDirection} goal; suggesting a ${adjustment > 0 ? "+" : ""}${adjustment} kcal/day adjustment.`,
  };
}
