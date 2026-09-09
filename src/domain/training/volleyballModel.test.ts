import { describe, expect, it } from "vitest";
import { estimateVolleyballCalories } from "./volleyballModel";

describe("estimateVolleyballCalories", () => {
  it("uses the flat 425 kcal/hour prior when no heart-rate data is available", () => {
    const result = estimateVolleyballCalories({
      durationMinutes: 120,
      averageHeartRate: null,
      restingHeartRate: null,
      observedMaxHeartRate: null,
      priorSessionsCount: 0,
    });
    expect(result.kcalPerHour).toBe(425);
    expect(result.estimateKcal).toBe(850);
  });

  it("scales the estimate up for a high-effort session (high HR reserve fraction)", () => {
    const highEffort = estimateVolleyballCalories({
      durationMinutes: 60,
      averageHeartRate: 175,
      restingHeartRate: 60,
      observedMaxHeartRate: 190,
      priorSessionsCount: 0,
    });
    const lowEffort = estimateVolleyballCalories({
      durationMinutes: 60,
      averageHeartRate: 90,
      restingHeartRate: 60,
      observedMaxHeartRate: 190,
      priorSessionsCount: 0,
    });
    expect(highEffort.estimateKcal).toBeGreaterThan(lowEffort.estimateKcal);
  });

  it("always returns a non-degenerate range around the point estimate", () => {
    const result = estimateVolleyballCalories({
      durationMinutes: 90,
      averageHeartRate: 140,
      restingHeartRate: 60,
      observedMaxHeartRate: 190,
      priorSessionsCount: 2,
    });
    expect(result.rangeLowKcal).toBeLessThan(result.estimateKcal);
    expect(result.rangeHighKcal).toBeGreaterThan(result.estimateKcal);
  });

  it("narrows the range as more prior sessions have calibrated the model", () => {
    const early = estimateVolleyballCalories({
      durationMinutes: 90,
      averageHeartRate: 140,
      restingHeartRate: 60,
      observedMaxHeartRate: 190,
      priorSessionsCount: 0,
    });
    const calibrated = estimateVolleyballCalories({
      durationMinutes: 90,
      averageHeartRate: 140,
      restingHeartRate: 60,
      observedMaxHeartRate: 190,
      priorSessionsCount: 10,
    });
    const earlyWidth = early.rangeHighKcal - early.rangeLowKcal;
    const calibratedWidth = calibrated.rangeHighKcal - calibrated.rangeLowKcal;
    expect(calibratedWidth).toBeLessThan(earlyWidth);
  });

  it("raises confidence as prior session count crosses the shared thresholds", () => {
    const zero = estimateVolleyballCalories({
      durationMinutes: 60,
      averageHeartRate: null,
      restingHeartRate: null,
      observedMaxHeartRate: null,
      priorSessionsCount: 0,
    });
    const many = estimateVolleyballCalories({
      durationMinutes: 60,
      averageHeartRate: null,
      restingHeartRate: null,
      observedMaxHeartRate: null,
      priorSessionsCount: 8,
    });
    expect(zero.confidence).toBe("exploratory");
    expect(many.confidence).toBe("high");
  });
});
