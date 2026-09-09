import { describe, expect, it } from "vitest";
import { rollingAverage, trendSlopePerWeek } from "./trend";

describe("rollingAverage", () => {
  it("averages only the available days near the start of the series", () => {
    const weights = [
      { date: "2026-03-01", weightLb: 128 },
      { date: "2026-03-02", weightLb: 129 },
    ];
    const result = rollingAverage(weights, 7);
    expect(result[0]).toEqual({ date: "2026-03-01", average: 128, sampleSize: 1 });
    expect(result[1]).toEqual({ date: "2026-03-02", average: 128.5, sampleSize: 2 });
  });

  it("uses a full trailing window once enough days exist", () => {
    const weights = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      weightLb: 128 + i, // 128..137
    }));
    const result = rollingAverage(weights, 7);
    // Day 10 (index 9, weight 137): average of days 4..10 (weights 131..137) = 134
    expect(result[9]!.average).toBe(134);
    expect(result[9]!.sampleSize).toBe(7);
  });
});

describe("trendSlopePerWeek", () => {
  it("returns 0 for fewer than 2 points", () => {
    expect(trendSlopePerWeek([{ date: "2026-03-01", weightLb: 128 }])).toBe(0);
  });

  it("detects a steady 0.5 lb/week gain", () => {
    const weights = Array.from({ length: 22 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      weightLb: 128 + (0.5 / 7) * i,
    }));
    expect(trendSlopePerWeek(weights)).toBeCloseTo(0.5, 2);
  });

  it("returns ~0 for a flat weight series", () => {
    const weights = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      weightLb: 128,
    }));
    expect(trendSlopePerWeek(weights)).toBeCloseTo(0, 5);
  });
});
