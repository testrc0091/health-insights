import { confidenceFromSampleSize } from "../confidenceThresholds";
import { splitByMeanAndCompare } from "../statHelpers";
import type { DraftInsight } from "../types";
import type { ISODate } from "../../models/common";

export interface SugarCaffeineRecoveryRecord {
  date: ISODate;
  caffeineMg: number;
  addedSugarG: number;
  /** 1-5, the night AFTER this date. */
  nextDaySleepQuality: number | null;
  /** 1-5, the day AFTER this date. */
  nextDayEnergy: number | null;
}

const MIN_DAYS = 5;
const MIN_EFFECT = 0.5;

/** Cross-analyzes caffeine intake against the following night's sleep quality —
 * brief's explicit "caffeine ... cross-analyzed against ... sleep" requirement. */
export function analyzeCaffeineVsSleep(records: SugarCaffeineRecoveryRecord[]): DraftInsight | null {
  const withData = records.filter(
    (r): r is SugarCaffeineRecoveryRecord & { nextDaySleepQuality: number } => r.nextDaySleepQuality !== null,
  );
  if (withData.length < MIN_DAYS) return null;

  const comparison = splitByMeanAndCompare(
    withData.map((r) => ({ exposureValue: r.caffeineMg, outcomeValue: r.nextDaySleepQuality })),
  );
  if (!comparison) return null;

  const hasSignal = comparison.effectSize <= -MIN_EFFECT;
  const confidence = confidenceFromSampleSize({ count: withData.length, isConsistent: hasSignal });

  return {
    kind: "correlation",
    text: hasSignal
      ? `Higher-caffeine days have been followed by sleep quality averaging ${Math.abs(comparison.effectSize).toFixed(1)} point(s) lower (of 5) than your more typical days.`
      : "No clear link yet between caffeine intake and next-night sleep quality in your data.",
    domain: "recovery",
    confidence,
    sampleSize: { days: withData.length },
    effectSize: comparison.effectSize,
    relatedEntityIds: [],
    generatedAt: new Date().toISOString(),
    algorithmVersion: "caffeine-vs-sleep.v1",
  };
}

/** Cross-analyzes added-sugar intake against the following day's self-reported
 * energy — brief's explicit "sugar ... cross-analyzed against ... energy" requirement. */
export function analyzeSugarVsEnergy(records: SugarCaffeineRecoveryRecord[]): DraftInsight | null {
  const withData = records.filter(
    (r): r is SugarCaffeineRecoveryRecord & { nextDayEnergy: number } => r.nextDayEnergy !== null,
  );
  if (withData.length < MIN_DAYS) return null;

  const comparison = splitByMeanAndCompare(
    withData.map((r) => ({ exposureValue: r.addedSugarG, outcomeValue: r.nextDayEnergy })),
  );
  if (!comparison) return null;

  const hasSignal = comparison.effectSize <= -MIN_EFFECT;
  const confidence = confidenceFromSampleSize({ count: withData.length, isConsistent: hasSignal });

  return {
    kind: "correlation",
    text: hasSignal
      ? `Higher-added-sugar days have been followed by energy averaging ${Math.abs(comparison.effectSize).toFixed(1)} point(s) lower (of 5) than your more typical days.`
      : "No clear link yet between added sugar intake and next-day energy in your data.",
    domain: "recovery",
    confidence,
    sampleSize: { days: withData.length },
    effectSize: comparison.effectSize,
    relatedEntityIds: [],
    generatedAt: new Date().toISOString(),
    algorithmVersion: "sugar-vs-energy.v1",
  };
}
