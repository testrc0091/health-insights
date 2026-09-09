import { describe, expect, it } from "vitest";
import { confidenceFromSampleSize } from "./confidenceThresholds";

describe("confidenceFromSampleSize — brief's exact threshold table", () => {
  it("is 'exploratory' below 2 observations", () => {
    expect(confidenceFromSampleSize({ count: 0, isConsistent: true })).toBe("exploratory");
    expect(confidenceFromSampleSize({ count: 1, isConsistent: true })).toBe("exploratory");
  });

  it("is 'low' for 2-3 observations regardless of consistency (brief: 'weak signal')", () => {
    expect(confidenceFromSampleSize({ count: 2, isConsistent: true })).toBe("low");
    expect(confidenceFromSampleSize({ count: 3, isConsistent: false })).toBe("low");
  });

  it("is 'moderate' for 4-6 observations only if the effect is consistent", () => {
    expect(confidenceFromSampleSize({ count: 4, isConsistent: true })).toBe("moderate");
    expect(confidenceFromSampleSize({ count: 6, isConsistent: true })).toBe("moderate");
  });

  it("falls back to 'low' for 4-6 observations when the effect is NOT consistent", () => {
    expect(confidenceFromSampleSize({ count: 5, isConsistent: false })).toBe("low");
  });

  it("is 'high' above 6 observations only if the effect persists", () => {
    expect(confidenceFromSampleSize({ count: 7, isConsistent: true })).toBe("high");
    expect(confidenceFromSampleSize({ count: 12, isConsistent: true })).toBe("high");
  });

  it("falls back to 'moderate' above 6 observations when the effect does not persist", () => {
    expect(confidenceFromSampleSize({ count: 8, isConsistent: false })).toBe("moderate");
  });
});
