import type { ConfidenceTier } from "../models/common";

export interface SampleSizeInput {
  /** Number of cycles observed (cycle-linked analyses) or sessions observed
   * (workout-linked analyses, per the brief: "For workout-based associations, use
   * number of sessions rather than cycles"). */
  count: number;
  /** Whether the effect held up consistently across the observed samples, not just
   * appeared once. An engine that ignores this and only looks at `count` would
   * violate the brief's "never overstate sparse data" rule just as much as ignoring
   * sample size entirely. */
  isConsistent: boolean;
}

/**
 * The brief's exact thresholds (single source of truth — every analyzer in
 * domain/insights/ must go through this function rather than re-implementing its own
 * cutoffs):
 * - < 2: exploratory only
 * - 2-3: weak/low signal
 * - 4-6: moderate confidence IF consistent (else still low)
 * - > 6: stronger/high confidence IF the effect persists (else moderate)
 */
export function confidenceFromSampleSize(input: SampleSizeInput): ConfidenceTier {
  if (input.count < 2) return "exploratory";
  if (input.count <= 3) return "low";
  if (input.count <= 6) return input.isConsistent ? "moderate" : "low";
  return input.isConsistent ? "high" : "moderate";
}

/** Human-readable qualifier to prefix/suffix any insight text, so weak evidence never
 * reads with the same confidence as strong evidence even in prose form. */
export function confidenceQualifier(tier: ConfidenceTier): string {
  switch (tier) {
    case "exploratory":
      return "Not enough data yet to say much — keep tracking.";
    case "low":
      return "Early signal; not yet a reliable pattern.";
    case "moderate":
      return "A consistent pattern across your recent history.";
    case "high":
      return "A well-established pattern in your own data.";
  }
}
