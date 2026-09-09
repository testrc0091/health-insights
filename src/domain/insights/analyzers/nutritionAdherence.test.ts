import { describe, expect, it } from "vitest";
import { analyzeNutritionAdherence, type NutritionAdherenceRecord } from "./nutritionAdherence";

function makeDays(consumedFractionOfTarget: number, count: number): NutritionAdherenceRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    label: "fiber" as const,
    targetAmount: 30,
    consumedAmount: 30 * consumedFractionOfTarget,
  }));
}

describe("analyzeNutritionAdherence", () => {
  it("returns null below the minimum day count", () => {
    expect(analyzeNutritionAdherence(makeDays(0.5, 3), "fiber")).toBeNull();
  });

  it("flags a consistent under-target pattern", () => {
    const result = analyzeNutritionAdherence(makeDays(0.5, 7), "fiber");
    expect(result).not.toBeNull();
    expect(result!.text).toContain("consistently under");
    expect(result!.effectSize).toBeLessThan(0);
  });

  it("does not flag a pattern when intake is close to target", () => {
    const result = analyzeNutritionAdherence(makeDays(1.0, 7), "fiber");
    expect(result!.text).not.toContain("consistently under");
    expect(result!.text).not.toContain("consistently over");
  });
});
