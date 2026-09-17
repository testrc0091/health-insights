import { describe, expect, it } from "vitest";
import { FOOD_DATABASE } from "./foodDatabase";

describe("FOOD_DATABASE", () => {
  it("never uses a fractional leading amount as the reference serving", () => {
    // A servingDescription like "1/2 medium (100g)" makes the database's OWN
    // reference already half a natural unit. Since the parser scales that
    // reference by whatever quantity the user types, a user saying "half an
    // avocado" (meaning half of ONE WHOLE avocado) gets multiplied against a
    // reference that's already half an avocado - landing on a quarter, not a
    // half (a real bug found in the avocado entry: "half an avocado" logged as
    // ~80 kcal, a quarter of a real one, not ~160 kcal).
    // Every reference serving must describe ONE WHOLE natural unit ("1 medium",
    // "1 cup", "1 large") so a user's own fraction/count applies correctly.
    const fractionalEntries = FOOD_DATABASE.filter((entry) =>
      /^\s*\d+\s*\/\s*\d+/.test(entry.servingDescription),
    );
    expect(fractionalEntries.map((e) => e.name)).toEqual([]);
  });

  it("uses a leading reference amount of exactly 1, unless the unit is dimensionally safe to scale anyway", () => {
    // A milder version of the same bug as above: whenever a reference describes MORE
    // than one natural unit ("2 tbsp", "2 slices", "8 pieces"), an explicit user
    // quantity in that same unit either (a) hits nutritionParser.ts's flat-multiplier
    // fallback, which is only correct by coincidence when it happens to equal the
    // reference's own count, or (b) would need a full volume<->weight conversion that
    // isn't possible without food-specific density. This was found in practice across
    // five entries during a full-database audit (bacon, peanut butter, hummus,
    // california roll, salad greens - none previously reported individually).
    //
    // The one safe exception: when the reference's leading unit is a GENERICALLY
    // convertible one (a weight word matching computeQuantityMultiplier's weight
    // table, or a volume word matching its volume table) AND the parenthetical
    // reference amount is in that SAME dimension - the ratio-based conversion in
    // computeQuantityMultiplier is then correct for ANY leading amount, not just 1.
    // Verified directly (see nutritionParser.test.ts): "100g cooked" meats convert
    // correctly for any explicit gram amount, and "5 fl oz"/"12 fl oz" drinks convert
    // correctly for any explicit volume amount, specifically because both sides of
    // the conversion share a dimension the code actually understands.
    const SAFE_NON_ONE_UNITS = new Set(["g", "fl"]); // "100g cooked" meats; "5 fl oz"/"12 fl oz" drinks
    const badEntries = FOOD_DATABASE.filter((entry) => {
      const match = entry.servingDescription.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z-]+)/);
      if (!match) return false;
      const [, amount, unit] = match;
      return amount !== "1" && !SAFE_NON_ONE_UNITS.has(unit!.toLowerCase());
    });
    expect(badEntries.map((e) => e.name)).toEqual([]);
  });

  it("keeps every entry's macros internally consistent with its stated calories", () => {
    // Cross-checks each entry against the standard Atwater factors (protein 4 kcal/g,
    // carbs 4 kcal/g, fat 9 kcal/g), netting fiber out of "carbs" first since fiber
    // contributes ~2 kcal/g, not ~4 - a real nutritional-science nuance, not an
    // approximation invented for this test (skipping it flagged several accurate
    // high-fiber vegetable entries as "wrong" during an audit pass). A big mismatch
    // here usually means a typo or a unit mistake, not natural data variance.
    //
    // Alcohol (~7 kcal/g) isn't tracked as its own macro field at all, so beer and
    // wine are excluded from this check rather than left to fail it permanently -
    // their calorie figures were independently checked by hand against typical
    // ABV/serving-size math (~14g alcohol in a 12oz beer or 5oz wine pours), not
    // skipped because they're unverified.
    const ALCOHOL_ENTRIES = new Set(["beer", "red wine"]);
    const problems: string[] = [];
    for (const entry of FOOD_DATABASE) {
      if (ALCOHOL_ENTRIES.has(entry.name)) continue;
      const netCarbs = Math.max(0, entry.carbsG - entry.fiberG);
      const computed = entry.proteinG * 4 + netCarbs * 4 + entry.fiberG * 2 + entry.fatG * 9;
      const tolerance = Math.max(3, entry.calories * 0.2);
      if (Math.abs(computed - entry.calories) > tolerance) {
        problems.push(`${entry.name}: stated ${entry.calories} kcal, macros imply ~${computed.toFixed(0)} kcal`);
      }
    }
    expect(problems).toEqual([]);
  });
});
