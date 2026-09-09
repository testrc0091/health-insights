import type { ActivityType, DayOfWeekPlan } from "../models/common";

export interface ActivityCalorieDefaults {
  lifting: number;
  volleyball: number;
  recovery: number;
  rest: number;
  other: number;
}

/**
 * Brief's exact example schedule: lifting ~2,400, volleyball ~2,750-2,950 (2,850
 * midpoint used as the default), recovery lower. `rest`/`other` aren't given explicit
 * numbers in the brief — documented assumption: rest sits below recovery, since it
 * implies zero planned activity at all (see IMPLEMENTATION_PLAN.md).
 */
export const DEFAULT_ACTIVITY_CALORIE_TARGETS: ActivityCalorieDefaults = {
  lifting: 2400,
  volleyball: 2850,
  recovery: 2250,
  rest: 2100,
  other: 2400,
};

/** A day's calorie target: an explicit per-day override always wins; otherwise the
 * activity-type default applies. This is what lets "different targets per day"
 * (brief's core nutrition requirement) work without a special case in the UI. */
export function resolveDayCalorieTarget(
  plan: Pick<DayOfWeekPlan, "activityType" | "calorieTarget">,
  defaults: ActivityCalorieDefaults = DEFAULT_ACTIVITY_CALORIE_TARGETS,
): number {
  return plan.calorieTarget ?? defaults[plan.activityType as ActivityType];
}

/** The weekly-average target implied by a full 7-day schedule — used to sanity-check
 * a schedule against the user's overall weekly-average goal (brief's ~2,500/day). */
export function weeklyAverageCalorieTarget(
  schedule: Pick<DayOfWeekPlan, "activityType" | "calorieTarget">[],
  defaults: ActivityCalorieDefaults = DEFAULT_ACTIVITY_CALORIE_TARGETS,
): number {
  if (schedule.length === 0) return 0;
  const total = schedule.reduce((sum, plan) => sum + resolveDayCalorieTarget(plan, defaults), 0);
  return total / schedule.length;
}
