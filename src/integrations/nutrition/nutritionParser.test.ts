import { describe, expect, it } from "vitest";
import { parseNutritionText } from "./nutritionParser";

describe("parseNutritionText", () => {
  it("parses a quantity + known food and scales its macros", () => {
    const [banana] = parseNutritionText("2 bananas");
    expect(banana!.calories).toBeCloseTo(210, 0);
    expect(banana!.confidence).toBe("medium");
  });

  it("carries caffeine through for a matched caffeinated item", () => {
    const [coffee] = parseNutritionText("a coffee");
    expect(coffee!.caffeineMg).toBe(95);
  });

  it("splits multiple foods joined by 'and'", () => {
    const items = parseNutritionText("two coffees and a donut");
    expect(items).toHaveLength(2);
    expect(items[1]!.name).toContain("donut");
  });

  it("falls back to a low-confidence range estimate for an unrecognized food", () => {
    const [item] = parseNutritionText("some exotic dragon fruit smoothie bowl");
    expect(item!.confidence).toBe("low");
    expect(item!.calorieRangeLow).toBeLessThan(item!.calories);
    expect(item!.calorieRangeHigh).toBeGreaterThan(item!.calories);
  });
});
