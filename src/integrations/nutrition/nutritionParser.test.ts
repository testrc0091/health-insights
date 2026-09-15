import { describe, expect, it } from "vitest";
import { parseNutritionText } from "./nutritionParser";

describe("parseNutritionText", () => {
   it("parses a quantity + known food and scales its macros", () => {
    const [banana] = parseNutritionText("2 bananas");
    expect(banana!.calories).toBeCloseTo(210, 0);
    expect(banana!.confidence).toBe("high"); // single-ingredient food, tight USDA reference
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
    const [item] = parseNutritionText("a bowl of imaginary glorp stew");
    expect(item!.confidence).toBe("low");
    expect(item!.calorieRangeLow).toBeLessThan(item!.calories);
    expect(item!.calorieRangeHigh).toBeGreaterThan(item!.calories);
  });

  it("keeps a drink and a milk modifier as one item when the drink's own reference already assumes it", () => {
    const items = parseNutritionText("a latte with whole milk");
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toContain("latte");
    expect(items[0]!.name).toContain("with whole milk");
  });

  it("still splits into two foods when 'with' isn't just describing how the first was made", () => {
    const items = parseNutritionText("chicken with rice");
    expect(items).toHaveLength(2);
    expect(items[0]!.name).toContain("chicken");
    expect(items[1]!.name).toContain("rice");
  });

  it("converts an explicit volume unit into an accurate multiplier instead of a serving count", () => {
    const [doubled] = parseNutritionText("480 ml coffee"); // coffee's reference is 1 cup = 240ml
    expect(doubled!.calories).toBeCloseTo(4, 0); // 2x coffee's 2 kcal reference, not 480x
  });

  it("converts an explicit weight unit into an accurate multiplier instead of a serving count", () => {
    const [doubled] = parseNutritionText("200 g chicken breast"); // reference is 100g cooked
    expect(doubled!.calories).toBeCloseTo(330, 0); // 2x chicken breast's 165 kcal reference
  });
});
