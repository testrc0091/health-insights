import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACTIVITY_CALORIE_TARGETS,
  resolveDayCalorieTarget,
  weeklyAverageCalorieTarget,
} from "./activityAdjustedTarget";
import type { DayOfWeekPlan } from "../models/common";

// The brief's exact example week: Mon-Thu lifting, Fri/Sun volleyball, Sat recovery.
const BRIEF_SCHEDULE: DayOfWeekPlan[] = [
  { day: "mon", activityType: "lifting", calorieTarget: null },
  { day: "tue", activityType: "lifting", calorieTarget: null },
  { day: "wed", activityType: "lifting", calorieTarget: null },
  { day: "thu", activityType: "lifting", calorieTarget: null },
  { day: "fri", activityType: "volleyball", calorieTarget: null },
  { day: "sat", activityType: "recovery", calorieTarget: null },
  { day: "sun", activityType: "volleyball", calorieTarget: null },
];

describe("resolveDayCalorieTarget", () => {
  it("uses the activity-type default when no per-day override is set", () => {
    expect(resolveDayCalorieTarget({ activityType: "lifting", calorieTarget: null })).toBe(2400);
    expect(resolveDayCalorieTarget({ activityType: "volleyball", calorieTarget: null })).toBe(2850);
    expect(resolveDayCalorieTarget({ activityType: "recovery", calorieTarget: null })).toBe(2250);
  });

  it("lets an explicit override win over the activity default (e.g. a known-heavy volleyball day)", () => {
    expect(resolveDayCalorieTarget({ activityType: "volleyball", calorieTarget: 2950 })).toBe(2950);
  });
});

describe("weeklyAverageCalorieTarget", () => {
  it("matches the brief's ~2,500 kcal/day weekly average for its own example schedule", () => {
    const average = weeklyAverageCalorieTarget(BRIEF_SCHEDULE);
    // (2400*4 + 2850*2 + 2250) / 7 = 2507.14 — within a rounding tolerance of the
    // brief's stated ~2,500/day weekly-average target.
    expect(average).toBeCloseTo(2507.14, 1);
  });

  it("returns 0 for an empty schedule rather than dividing by zero", () => {
    expect(weeklyAverageCalorieTarget([])).toBe(0);
  });

  it("uses a caller-supplied defaults table instead of the built-in one when given", () => {
    const customDefaults = { ...DEFAULT_ACTIVITY_CALORIE_TARGETS, lifting: 2500 };
    const average = weeklyAverageCalorieTarget(
      [{ activityType: "lifting", calorieTarget: null }],
      customDefaults,
    );
    expect(average).toBe(2500);
  });
});
