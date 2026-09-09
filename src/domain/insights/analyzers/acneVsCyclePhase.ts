import { confidenceFromSampleSize } from "../confidenceThresholds";
import { compareGroups } from "../statHelpers";
import type { DraftInsight } from "../types";
import type { CyclePhaseName } from "../../cycle/phaseEstimation";

export interface CycleAcneRecord {
  cycleIndex: number;
  phase: CyclePhaseName;
  /** 0-4, matches SkinEntry.acneSeverity. */
  acneSeverity: number;
}

const MIN_EFFECT = 0.3;

/** Cross-analyzes acne severity against cycle phase — brief's explicit "skin ...
 * analyzed against cycle" requirement, only once sufficient observations exist. */
export function analyzeAcneVsCyclePhase(
  records: CycleAcneRecord[],
  phase: CyclePhaseName,
): DraftInsight | null {
  const inPhase = records.filter((r) => r.phase === phase);
  const outsidePhase = records.filter((r) => r.phase !== phase);
  if (inPhase.length === 0 || outsidePhase.length === 0) return null;

  const cyclesObserved = new Set(inPhase.map((r) => r.cycleIndex)).size;
  const comparison = compareGroups(
    inPhase.map((r) => r.acneSeverity),
    outsidePhase.map((r) => r.acneSeverity),
  );
  const hasSignal = Math.abs(comparison.effectSize) >= MIN_EFFECT;
  const confidence = confidenceFromSampleSize({ count: cyclesObserved, isConsistent: hasSignal });

  const text = hasSignal
    ? `Acne severity during your ${phase} phase has averaged ${Math.abs(comparison.effectSize).toFixed(1)} point(s) ${comparison.effectSize > 0 ? "higher" : "lower"} (of 4) than the rest of your cycle, across ${cyclesObserved} observed cycle(s).`
    : `No clear acne-vs-${phase}-phase pattern yet.`;

  return {
    kind: "observation",
    text,
    domain: "skin",
    confidence,
    sampleSize: { cycles: cyclesObserved, days: inPhase.length + outsidePhase.length },
    effectSize: comparison.effectSize,
    relatedEntityIds: [],
    generatedAt: new Date().toISOString(),
    algorithmVersion: "acne-vs-cycle-phase.v1",
  };
}
