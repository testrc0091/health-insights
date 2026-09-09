import { confidenceFromSampleSize } from "../confidenceThresholds";
import { splitByMeanAndCompare } from "../statHelpers";
import type { DraftInsight } from "../types";
import type { ISODate } from "../../models/common";

export interface TrainingLoadSorenessRecord {
  date: ISODate;
  trainingLoadScore: number;
  /** 1-5, the day AFTER this date. */
  nextDaySoreness: number | null;
}

const MIN_DAYS = 5;
const MIN_EFFECT = 0.5;

/** Cross-analyzes training load against next-day soreness — feeds the Training-load &
 * Recovery screen's readiness framing. */
export function analyzeTrainingLoadVsSoreness(records: TrainingLoadSorenessRecord[]): DraftInsight | null {
  const withData = records.filter(
    (r): r is TrainingLoadSorenessRecord & { nextDaySoreness: number } => r.nextDaySoreness !== null,
  );
  if (withData.length < MIN_DAYS) return null;

  const comparison = splitByMeanAndCompare(
    withData.map((r) => ({ exposureValue: r.trainingLoadScore, outcomeValue: r.nextDaySoreness })),
  );
  if (!comparison) return null;

  const hasSignal = comparison.effectSize >= MIN_EFFECT;
  const confidence = confidenceFromSampleSize({ count: withData.length, isConsistent: hasSignal });

  return {
    kind: "correlation",
    text: hasSignal
      ? `Higher training-load days have been followed by soreness averaging ${comparison.effectSize.toFixed(1)} point(s) higher (of 5) than lighter days.`
      : "No clear link yet between training load and next-day soreness in your data.",
    domain: "training",
    confidence,
    sampleSize: { days: withData.length },
    effectSize: comparison.effectSize,
    relatedEntityIds: [],
    generatedAt: new Date().toISOString(),
    algorithmVersion: "training-load-vs-soreness.v1",
  };
}
