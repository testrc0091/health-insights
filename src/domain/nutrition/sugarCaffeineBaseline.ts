import { confidenceFromSampleSize } from "../insights/confidenceThresholds";
import { average, standardDeviation } from "../insights/statHelpers";
import type { ConfidenceTier, ISODate } from "../models/common";

export type SugarCaffeineMetric = "addedSugarG" | "totalSugarG" | "caffeineMg";

export interface DailyIntakeTotal {
  date: ISODate;
  addedSugarG: number;
  totalSugarG: number;
  caffeineMg: number;
}

export interface BaselineFlag {
  metric: SugarCaffeineMetric;
  todayValue: number;
  baselineMean: number;
  baselineStdDev: number;
  /** Brief's explicit framing: "not as bad, but as events for correlation analysis." */
  isUnusuallyHigh: boolean;
  confidence: ConfidenceTier;
  sampleSizeDays: number;
}

const BASELINE_WINDOW_DAYS = 21;
const HIGH_THRESHOLD_STD_DEVS = 1.5;
const MIN_STD_DEV_FOR_FLAGGING = 0.0001; // guard against flagging noise on a flat/zero history
const METRICS: SugarCaffeineMetric[] = ["addedSugarG", "totalSugarG", "caffeineMg"];

/**
 * Flags today's sugar/caffeine intake as unusually high relative to the user's OWN
 * recent typical days — never a population norm, and never framed as "bad." Every
 * flag carries the sample size it's based on, so a flag from 2 days of history reads
 * differently from one built on 3 weeks.
 */
export function flagUnusualIntakeDays(
  history: DailyIntakeTotal[],
  today: DailyIntakeTotal,
): BaselineFlag[] {
  const window = [...history]
    .filter((day) => day.date !== today.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, BASELINE_WINDOW_DAYS);

  return METRICS.map((metric) => {
    const values = window.map((day) => day[metric]);
    const mean = average(values);
    const stdDev = standardDeviation(values, mean);
    const todayValue = today[metric];
    const isUnusuallyHigh =
      values.length >= 2 &&
      stdDev > MIN_STD_DEV_FOR_FLAGGING &&
      todayValue > mean + HIGH_THRESHOLD_STD_DEVS * stdDev;

    return {
      metric,
      todayValue,
      baselineMean: mean,
      baselineStdDev: stdDev,
      isUnusuallyHigh,
      confidence: confidenceFromSampleSize({ count: values.length, isConsistent: true }),
      sampleSizeDays: values.length,
    };
  });
}
