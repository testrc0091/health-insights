export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function standardDeviation(values: number[], mean = average(values)): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export interface GroupComparison {
  exposedMean: number;
  unexposedMean: number;
  exposedCount: number;
  unexposedCount: number;
  /** exposedMean - unexposedMean. Positive means the exposed group ran higher. */
  effectSize: number;
}

/** Compares the mean of an outcome variable between an "exposed" group (e.g. high-
 * sugar days) and an "unexposed" group (e.g. typical days) — the basic building block
 * shared by every "does X relate to Y" analyzer in domain/insights/analyzers/. */
export function compareGroups(exposedValues: number[], unexposedValues: number[]): GroupComparison {
  const exposedMean = average(exposedValues);
  const unexposedMean = average(unexposedValues);
  return {
    exposedMean,
    unexposedMean,
    exposedCount: exposedValues.length,
    unexposedCount: unexposedValues.length,
    effectSize: exposedMean - unexposedMean,
  };
}

/** Splits records into "above the mean exposure" vs "at-or-below" and compares their
 * outcome values — a no-fuss, dependency-free stand-in for a real correlation
 * coefficient, appropriate for the small day-counts this app will actually have.
 * Returns null when either side of the split would be empty (all-identical exposure
 * values), since no comparison is possible. */
export function splitByMeanAndCompare(
  records: { exposureValue: number; outcomeValue: number }[],
): GroupComparison | null {
  if (records.length < 2) return null;
  const meanExposure = average(records.map((r) => r.exposureValue));
  const high = records.filter((r) => r.exposureValue > meanExposure).map((r) => r.outcomeValue);
  const typical = records.filter((r) => r.exposureValue <= meanExposure).map((r) => r.outcomeValue);
  if (high.length === 0 || typical.length === 0) return null;
  return compareGroups(high, typical);
}
