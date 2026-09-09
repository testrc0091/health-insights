import { confidenceFromSampleSize } from "../confidenceThresholds";
import { compareGroups } from "../statHelpers";
import type { DraftInsight } from "../types";
import type { CyclePhaseName } from "../../cycle/phaseEstimation";

export interface CycleWeightRecord {
  /** Which observed cycle (0-based) this reading belongs to — used as the sample size
   * for confidence, per the brief's "use cycle count for cycle-linked analyses" rule. */
  cycleIndex: number;
  phase: CyclePhaseName;
  weightLb: number;
}

const MIN_EFFECT_LB = 0.5;

/**
 * Compares average weight during one cycle phase against all other logged days. A
 * real difference here (e.g. luteal-phase water retention) is common and is
 * deliberately NOT framed as evidence a calorie target needs changing — that
 * determination belongs to nutrition/calibration.ts's longer multi-week trend, not a
 * single-phase snapshot, so this analyzer's own text says so explicitly.
 */
export function analyzeWeightVsCyclePhase(
  records: CycleWeightRecord[],
  phase: CyclePhaseName,
): DraftInsight | null {
  const inPhase = records.filter((r) => r.phase === phase);
  const outsidePhase = records.filter((r) => r.phase !== phase);
  if (inPhase.length === 0 || outsidePhase.length === 0) return null;

  const cyclesObserved = new Set(inPhase.map((r) => r.cycleIndex)).size;
  const comparison = compareGroups(
    inPhase.map((r) => r.weightLb),
    outsidePhase.map((r) => r.weightLb),
  );
  const hasSignal = Math.abs(comparison.effectSize) >= MIN_EFFECT_LB;
  const confidence = confidenceFromSampleSize({ count: cyclesObserved, isConsistent: hasSignal });

  const text = hasSignal
    ? `Weight tends to run about ${Math.abs(comparison.effectSize).toFixed(1)} lb ${comparison.effectSize > 0 ? "higher" : "lower"} during your ${phase} phase, across ${cyclesObserved} observed cycle(s). This looks like a cycle-related pattern, not evidence your calorie target needs changing — nutrition calibration uses your longer-term multi-week trend instead.`
    : `Weight during your ${phase} phase looks about the same as the rest of your cycle so far — no adjustment suggested.`;

  return {
    kind: "observation",
    text,
    domain: "cycle",
    confidence,
    sampleSize: { cycles: cyclesObserved, days: inPhase.length + outsidePhase.length },
    effectSize: comparison.effectSize,
    relatedEntityIds: [],
    generatedAt: new Date().toISOString(),
    algorithmVersion: "weight-vs-cycle-phase.v1",
  };
}
