import { parseIsoDate } from "../dateUtils";
import type { ISODate } from "../models/common";

export interface DailyWeight {
  date: ISODate;
  weightLb: number;
}

export interface RollingAveragePoint {
  date: ISODate;
  average: number;
  /** How many days actually fed this average — < windowSize near the start of the
   * series. Callers can use this to grey out / hide early low-confidence points. */
  sampleSize: number;
}

/** Trailing rolling average ending at each date (uses however many prior days are
 * available near the start of the series rather than padding with fabricated data). */
export function rollingAverage(
  weights: DailyWeight[],
  windowSize = 7,
): RollingAveragePoint[] {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((_, index) => {
    const windowStart = Math.max(0, index - windowSize + 1);
    const window = sorted.slice(windowStart, index + 1);
    const average = window.reduce((sum, w) => sum + w.weightLb, 0) / window.length;
    return { date: sorted[index]!.date, average, sampleSize: window.length };
  });
}

/**
 * Simple linear regression slope of raw weight over time, expressed in lb/week.
 * Used to answer "is my weight actually trending toward my goal" rather than reacting
 * to any single day-to-day fluctuation.
 */
export function trendSlopePerWeek(weights: DailyWeight[]): number {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return 0;

  const firstDate = parseIsoDate(sorted[0]!.date).getTime();
  const xs = sorted.map((w) => (parseIsoDate(w.date).getTime() - firstDate) / (1000 * 60 * 60 * 24));
  const ys = sorted.map((w) => w.weightLb);

  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (xs[i]! - meanX) * (ys[i]! - meanY);
    denominator += (xs[i]! - meanX) ** 2;
  }
  const slopePerDay = denominator === 0 ? 0 : numerator / denominator;
  return slopePerDay * 7;
}
