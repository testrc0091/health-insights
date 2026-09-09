export interface FoodDatabaseEntry {
  name: string;
  /** Lowercase match strings, longest-first isn't required here — nutritionParser.ts
   * sorts all aliases across the whole database by length before matching. */
  aliases: string[];
  servingDescription: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  addedSugarG: number | null;
  totalSugarG: number | null;
  caffeineMg: number | null;
}

/**
 * A small starter set of common foods so the on-device NL parser (no AI/network,
 * per the user's choice) is genuinely useful from day one rather than an empty shell.
 * Values are per the "servingDescription" quantity, scaled by whatever quantity the
 * parser extracts from the user's text. Meant to grow over time — the UI's "add a
 * custom food" flow (Nutrition screen) appends to this list in IndexedDB, not here.
 */
export const FOOD_DATABASE: FoodDatabaseEntry[] = [
  { name: "banana", aliases: ["banana"], servingDescription: "1 medium (118g)", calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, fiberG: 3.1, addedSugarG: 0, totalSugarG: 14, caffeineMg: 0 },
  { name: "apple", aliases: ["apple"], servingDescription: "1 medium (182g)", calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, fiberG: 4.4, addedSugarG: 0, totalSugarG: 19, caffeineMg: 0 },
  { name: "egg", aliases: ["egg", "eggs"], servingDescription: "1 large", calories: 78, proteinG: 6.3, carbsG: 0.6, fatG: 5.3, fiberG: 0, addedSugarG: 0, totalSugarG: 0.6, caffeineMg: 0 },
  { name: "chicken breast", aliases: ["chicken breast", "chicken"], servingDescription: "100g cooked", calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0 },
  { name: "white rice", aliases: ["white rice", "rice"], servingDescription: "1 cup cooked (158g)", calories: 205, proteinG: 4.3, carbsG: 45, fatG: 0.4, fiberG: 0.6, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0 },
  { name: "greek yogurt", aliases: ["greek yogurt", "yogurt"], servingDescription: "1 cup (245g) plain nonfat", calories: 150, proteinG: 25, carbsG: 9, fatG: 0.5, fiberG: 0, addedSugarG: 0, totalSugarG: 9, caffeineMg: 0 },
  { name: "coffee", aliases: ["coffee"], servingDescription: "1 cup (240ml) brewed black", calories: 2, proteinG: 0.3, carbsG: 0, fatG: 0, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 95 },
  { name: "espresso", aliases: ["espresso"], servingDescription: "1 shot (30ml)", calories: 3, proteinG: 0.1, carbsG: 0.5, fatG: 0, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 64 },
  { name: "black tea", aliases: ["black tea", "tea"], servingDescription: "1 cup (240ml)", calories: 2, proteinG: 0, carbsG: 0.7, fatG: 0, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 47 },
  { name: "donut", aliases: ["donut", "doughnut"], servingDescription: "1 glazed (60g)", calories: 240, proteinG: 3, carbsG: 27, fatG: 14, fiberG: 0.7, addedSugarG: 12, totalSugarG: 12, caffeineMg: 0 },
  { name: "protein shake", aliases: ["protein shake", "whey shake"], servingDescription: "1 scoop in water", calories: 120, proteinG: 24, carbsG: 3, fatG: 1.5, fiberG: 0, addedSugarG: 1, totalSugarG: 2, caffeineMg: 0 },
  { name: "oatmeal", aliases: ["oatmeal", "oats"], servingDescription: "1 cup cooked (234g) plain", calories: 158, proteinG: 6, carbsG: 27, fatG: 3.2, fiberG: 4, addedSugarG: 0, totalSugarG: 1, caffeineMg: 0 },
  { name: "peanut butter", aliases: ["peanut butter"], servingDescription: "2 tbsp (32g)", calories: 190, proteinG: 8, carbsG: 7, fatG: 16, fiberG: 2, addedSugarG: 1.5, totalSugarG: 1.5, caffeineMg: 0 },
  { name: "salmon", aliases: ["salmon"], servingDescription: "100g cooked", calories: 208, proteinG: 22, carbsG: 0, fatG: 13, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0 },
  { name: "broccoli", aliases: ["broccoli"], servingDescription: "1 cup cooked (156g)", calories: 55, proteinG: 3.7, carbsG: 11, fatG: 0.6, fiberG: 5.1, addedSugarG: 0, totalSugarG: 2.2, caffeineMg: 0 },
  { name: "sweet potato", aliases: ["sweet potato"], servingDescription: "1 medium (150g) baked", calories: 130, proteinG: 2.3, carbsG: 30, fatG: 0.2, fiberG: 4, addedSugarG: 0, totalSugarG: 9.6, caffeineMg: 0 },
  { name: "whole milk", aliases: ["whole milk", "milk"], servingDescription: "1 cup (244g)", calories: 149, proteinG: 8, carbsG: 12, fatG: 8, fiberG: 0, addedSugarG: 0, totalSugarG: 12, caffeineMg: 0 },
  { name: "almonds", aliases: ["almonds"], servingDescription: "1 oz (28g), ~23 nuts", calories: 164, proteinG: 6, carbsG: 6, fatG: 14, fiberG: 3.5, addedSugarG: 0, totalSugarG: 1.2, caffeineMg: 0 },
  { name: "protein bar", aliases: ["protein bar"], servingDescription: "1 bar (60g)", calories: 220, proteinG: 20, carbsG: 24, fatG: 8, fiberG: 5, addedSugarG: 5, totalSugarG: 6, caffeineMg: 0 },
  { name: "energy drink", aliases: ["energy drink", "red bull", "monster"], servingDescription: "1 can (250ml)", calories: 110, proteinG: 0, carbsG: 28, fatG: 0, fiberG: 0, addedSugarG: 27, totalSugarG: 27, caffeineMg: 80 },
  { name: "soda", aliases: ["soda", "coke", "cola"], servingDescription: "1 can (355ml)", calories: 140, proteinG: 0, carbsG: 39, fatG: 0, fiberG: 0, addedSugarG: 39, totalSugarG: 39, caffeineMg: 34 },
  { name: "pasta", aliases: ["pasta", "spaghetti"], servingDescription: "1 cup cooked (140g)", calories: 220, proteinG: 8, carbsG: 43, fatG: 1.3, fiberG: 2.5, addedSugarG: 0, totalSugarG: 0.8, caffeineMg: 0 },
  { name: "avocado", aliases: ["avocado"], servingDescription: "1/2 medium (100g)", calories: 160, proteinG: 2, carbsG: 8.5, fatG: 14.7, fiberG: 6.7, addedSugarG: 0, totalSugarG: 0.7, caffeineMg: 0 },
  { name: "steak", aliases: ["steak", "beef"], servingDescription: "100g cooked", calories: 271, proteinG: 25, carbsG: 0, fatG: 19, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0 },
  { name: "toast", aliases: ["toast", "slice of bread", "bread"], servingDescription: "1 slice (28g) whole wheat", calories: 69, proteinG: 3.6, carbsG: 12, fatG: 1, fiberG: 1.9, addedSugarG: 1.4, totalSugarG: 1.6, caffeineMg: 0 },
];
