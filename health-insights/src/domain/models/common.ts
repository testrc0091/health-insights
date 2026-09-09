export type ISODate = string; // "2026-03-05"
export type ISODateTime = string; // full timestamp

export type ActivityType = "lifting" | "volleyball" | "recovery" | "rest" | "other";
export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type ConfidenceTier = "exploratory" | "low" | "moderate" | "high";
export type CyclePhaseConfidence = "high" | "medium" | "low";

export interface DerivedMetric<T> {
  name: string;
  value: T;
  rangeLow?: T;
  rangeHigh?: T;
  confidence: ConfidenceTier;
  sources: string[];
  algorithmVersion: string;
  computedAt: ISODateTime;
}

export interface DayOfWeekPlan {
  day: DayOfWeek;
  activityType: ActivityType;
  /** null = use the activity-type default target, not a manual override. */
  calorieTarget: number | null;
}
