import { describe, expect, it } from "vitest";
import { parseNutritionText } from "./nutritionParser";
import type { FoodDatabaseEntry } from "./foodDatabase";

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

  it("shows the food's own standard serving when no quantity is typed at all", () => {
    const items = parseNutritionText("rice, lentils, salmon, broccoli");
    for (const item of items) {
      // every item should carry SOME portion descriptor, not just the bare food name
      expect(item.name.split(" ").length).toBeGreaterThan(1);
    }
    expect(items.find((i) => i.name.includes("salmon"))!.name).toContain("100g");
    expect(items.find((i) => i.name.includes("rice"))!.name).toContain("cup");
  });

  it("does not repeat the food name when the standard-serving label already contains it", () => {
    const [burrito] = parseNutritionText("burrito");
    const occurrences = burrito!.name.toLowerCase().split("burrito").length - 1;
    expect(occurrences).toBe(1);
  });

  it("logs half a whole avocado as half its calories, not a quarter", () => {
    // Regression test: avocado's reference serving used to be "1/2 medium" itself,
    // so "half an avocado" (0.5x) landed on a quarter of a real avocado (~80 kcal)
    // instead of half (~160 kcal). The reference must describe ONE WHOLE avocado.
    const [half] = parseNutritionText("half an avocado");
    const [whole] = parseNutritionText("an avocado");
    expect(half!.calories).toBeCloseTo(whole!.calories / 2, 0);
    expect(half!.calories).toBeGreaterThan(140);
    expect(half!.calories).toBeLessThan(180);
  });

  // --- Full-database audit regressions: entries whose reference serving described
  // MORE than one natural unit (2 tbsp, 2 slices, 8 pieces), the same underlying bug
  // class as avocado, found by systematically checking every entry rather than
  // waiting for each one to surface individually.

  it("logs a single slice of bacon as one slice, not the old two-slice reference", () => {
    const [oneSlice] = parseNutritionText("a slice of bacon");
    const [twoSlices] = parseNutritionText("2 slices of bacon");
    expect(twoSlices!.calories).toBeCloseTo(oneSlice!.calories * 2, 0);
    expect(oneSlice!.calories).toBeGreaterThan(30);
    expect(oneSlice!.calories).toBeLessThan(55);
  });

  it("logs a single tablespoon of peanut butter as one tablespoon, not the old two-tablespoon reference", () => {
    const [oneTbsp] = parseNutritionText("a tablespoon of peanut butter");
    const [twoTbsp] = parseNutritionText("2 tbsp peanut butter");
    expect(twoTbsp!.calories).toBeCloseTo(oneTbsp!.calories * 2, 0);
    expect(oneTbsp!.calories).toBeGreaterThan(80);
    expect(oneTbsp!.calories).toBeLessThan(105);
  });

  it("logs a single tablespoon of hummus as one tablespoon, not the old two-tablespoon reference", () => {
    const [oneTbsp] = parseNutritionText("a tablespoon of hummus");
    expect(oneTbsp!.calories).toBeGreaterThan(25);
    expect(oneTbsp!.calories).toBeLessThan(45);
  });

  it("logs a single piece of california roll as one piece, not the old eight-piece reference", () => {
    const [onePiece] = parseNutritionText("a piece of california roll");
    const [eightPieces] = parseNutritionText("8 pieces california roll");
    expect(eightPieces!.calories).toBeCloseTo(onePiece!.calories * 8, 0);
    expect(onePiece!.calories).toBeGreaterThan(20);
    expect(onePiece!.calories).toBeLessThan(45);
  });

  it("logs a single cup of salad greens as one cup, not the old two-cup reference", () => {
    const [oneCup] = parseNutritionText("a cup of lettuce");
    expect(oneCup!.calories).toBeGreaterThan(2);
    expect(oneCup!.calories).toBeLessThan(9);
  });

  // --- Proof that entries which legitimately keep a non-1 leading reference amount
  // (because their unit is generically convertible and shares the parenthetical's
  // dimension) still scale correctly for ANY explicit quantity, not just the
  // reference's own count - backing the exemption documented in foodDatabase.test.ts.

  it("scales a 100g-referenced meat correctly for an arbitrary explicit gram amount", () => {
    const [amount] = parseNutritionText("250 g salmon"); // reference is 100g cooked = 208 kcal
    expect(amount!.calories).toBeCloseTo(208 * 2.5, 0);
  });

  it("scales a fl-oz-referenced drink correctly even though its own reference isn't 1 fl oz", () => {
    const [glass] = parseNutritionText("5 fl oz red wine"); // reference is 5 fl oz (147ml) = 125 kcal
    const [doubleGlass] = parseNutritionText("10 fl oz red wine");
    // 147ml is a rounded stand-in for 5 fl oz's true ~147.9ml, so the reference amount
    // itself isn't exact to the kcal - what matters is that doubling the input exactly
    // doubles the output (proving the conversion is a real ratio, not a flat 1x/2x
    // guess) and that the reference amount alone lands within a sane range of 125.
    expect(glass!.calories).toBeGreaterThan(120);
    expect(glass!.calories).toBeLessThan(130);
    expect(doubleGlass!.calories).toBeCloseTo(glass!.calories * 2, 0);
  });

  // --- Found while spot-checking random items + explicit quantities against USDA:
  // fractional cup measures of rice/lentils happen to come out right (their own
  // reference IS "1 cup"), but that's a coincidence of the data, not proof the parser
  // understands "cup" as a unit in that path - these two entries are the ones where a
  // mismatched real unit was silently accepted as a flat, falsely-precise multiplier.

  it("scales a half-cup measure correctly when the food's own reference is exactly 1 cup", () => {
    const [rice] = parseNutritionText("1/2 cup of rice");
    const [lentils] = parseNutritionText("1/2 cup of lentils");
    expect(rice!.calories).toBeCloseTo(205 * 0.5, 0);
    expect(lentils!.calories).toBeCloseTo(230 * 0.5, 0);
  });

  it("matches ribeye to its own fattier macros instead of silently substituting sirloin", () => {
    // Both entries share the word "steak," so without a dedicated ribeye entry the
    // longest-alias-wins matcher fell through to the generic "steak" (sirloin) data -
    // real, but wrong, macros for a noticeably fattier cut.
    const [ribeye] = parseNutritionText("a ribeye steak");
    const [sirloin] = parseNutritionText("a steak");
    expect(ribeye!.name).toContain("ribeye");
    expect(ribeye!.fatG).toBeGreaterThan(sirloin!.fatG);
    expect(ribeye!.calories).toBeGreaterThan(sirloin!.calories);
  });

  it("flags low confidence instead of a falsely-precise number when a real unit can't convert to the food's reference dimension", () => {
    // Balsamic vinegar's reference is "1 tbsp" - asking for cups is a real unit, just
    // not one computeQuantityMultiplier can convert without a density figure. Before
    // this fix, "1/4 cup" was silently read as a flat 0.25x multiplier (as if it meant
    // a quarter-tablespoon), presented with the food's normal high confidence.
    const [quarterCup] = parseNutritionText("1/4 cup balsamic vinegar");
    expect(quarterCup!.confidence).toBe("low");
    expect(quarterCup!.calorieRangeLow).toBeLessThan(quarterCup!.calories);
    expect(quarterCup!.calorieRangeHigh).toBeGreaterThan(quarterCup!.calories);
  });

  it("keeps normal high confidence for a same-dimension unit conversion that actually works", () => {
    const [wine] = parseNutritionText("5 fl oz red wine");
    expect(wine!.confidence).toBe("high");
  });

  it("does not falsely flag a spelled-out unit as a mismatch against its own abbreviation", () => {
    // "tablespoon" and the peanut butter entry's own "tbsp" reference are the same
    // real-world unit under different spellings - this must NOT be treated the same
    // as a genuine cup-vs-tbsp mismatch just because the words look different.
    const [oneTbsp] = parseNutritionText("a tablespoon of peanut butter");
    expect(oneTbsp!.confidence).toBe("high");
    expect(oneTbsp!.calories).toBeCloseTo(94, 0);
  });

  // --- User-editable custom foods (added/edited from the Nutrition screen, persisted
  // in IndexedDB by the caller, never by this file - see customFoodRepository).

  it("matches a custom entry for a food the built-in database has no info for", () => {
    const customEntries: FoodDatabaseEntry[] = [
      {
        name: "dragon fruit",
        aliases: ["dragon fruit"],
        servingDescription: "1 cup (170g)",
        calories: 102,
        proteinG: 2.2,
        carbsG: 22,
        fatG: 0.5,
        fiberG: 5,
        addedSugarG: 0,
        totalSugarG: 8,
        caffeineMg: 0,
        confidence: "high",
      },
    ];
    const [item] = parseNutritionText("a cup of dragon fruit", customEntries);
    expect(item!.calories).toBeCloseTo(102, 0);
    expect(item!.confidence).toBe("high");
  });

  it("lets a custom entry override a built-in food sharing its alias", () => {
    // The built-in "ribeye steak" entry is 291 kcal/100g - a custom correction should
    // win over it rather than just adding a second, ignored candidate.
    const customEntries: FoodDatabaseEntry[] = [
      {
        name: "ribeye steak",
        aliases: ["ribeye steak", "ribeye"],
        servingDescription: "100g cooked",
        calories: 999,
        proteinG: 1,
        carbsG: 0,
        fatG: 1,
        fiberG: 0,
        addedSugarG: 0,
        totalSugarG: 0,
        caffeineMg: 0,
        confidence: "high",
      },
    ];
    const [withCustom] = parseNutritionText("a ribeye steak", customEntries);
    const [builtIn] = parseNutritionText("a ribeye steak");
    expect(withCustom!.calories).toBeCloseTo(999, 0);
    expect(builtIn!.calories).toBeCloseTo(291, 0);
  });
});
