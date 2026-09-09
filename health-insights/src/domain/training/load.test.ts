import { describe, expect, it } from "vitest";
import { aggregateWeeklyLoad, hasHeavyLowerBodyFollowedByHighImpact } from "./load";

describe("aggregateWeeklyLoad", () => {
  it("sums strength sets into upper/lower buckets", () => {
    const load = aggregateWeeklyLoad([
      { workoutType: "strength", durationMinutes: 40, upperBodySets: 10, lowerBodySets: 4 },
      { workoutType: "strength", durationMinutes: 35, upperBodySets: 6, lowerBodySets: 8 },
    ]);
    expect(load.upperBodyLoad).toBe(16);
    expect(load.lowerBodyLoad).toBe(12);
    expect(load.highImpactLoad).toBe(0);
  });

  it("counts volleyball toward lower-body and high-impact load even with no Strong data for that day", () => {
    const load = aggregateWeeklyLoad([{ workoutType: "volleyball", durationMinutes: 120 }]);
    expect(load.lowerBodyLoad).toBe(120);
    expect(load.highImpactLoad).toBe(180);
    expect(load.upperBodyLoad).toBe(0);
  });

  it("combines strength and volleyball contributions across a full week", () => {
    const load = aggregateWeeklyLoad([
      { workoutType: "strength", durationMinutes: 40, upperBodySets: 10, lowerBodySets: 14 },
      { workoutType: "volleyball", durationMinutes: 134 },
    ]);
    expect(load.lowerBodyLoad).toBe(14 + 134);
    expect(load.highImpactLoad).toBe(134 * 1.5);
  });
});

describe("hasHeavyLowerBodyFollowedByHighImpact", () => {
  it("flags a heavy lower-body lift immediately followed by volleyball", () => {
    const flags = hasHeavyLowerBodyFollowedByHighImpact([
      { date: "2026-03-05", workoutType: "strength", lowerBodySets: 16 },
      { date: "2026-03-06", workoutType: "volleyball" },
    ]);
    expect(flags).toEqual([{ precedingDate: "2026-03-05", followingDate: "2026-03-06" }]);
  });

  it("does not flag a light lower-body session followed by volleyball", () => {
    const flags = hasHeavyLowerBodyFollowedByHighImpact([
      { date: "2026-03-05", workoutType: "strength", lowerBodySets: 4 },
      { date: "2026-03-06", workoutType: "volleyball" },
    ]);
    expect(flags).toEqual([]);
  });

  it("does not flag heavy lower-body lifting not followed by volleyball", () => {
    const flags = hasHeavyLowerBodyFollowedByHighImpact([
      { date: "2026-03-05", workoutType: "strength", lowerBodySets: 16 },
      { date: "2026-03-06", workoutType: "strength", lowerBodySets: 2 },
    ]);
    expect(flags).toEqual([]);
  });
});
