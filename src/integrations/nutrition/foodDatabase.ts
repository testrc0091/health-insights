export interface FoodDatabaseEntry {
  name: string;
  /** Lowercase match strings — nutritionParser.ts sorts all aliases across the whole
   * database by length before matching, so specificity order here doesn't matter. */
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
  /**
   * "high" = a single, well-defined ingredient at a standard serving (USDA reference
   * data for something like "chicken breast, cooked" varies little in practice).
   * "medium" = a composite/branded/recipe food (a burrito, a smoothie, a specific
   * brand's protein bar) whose real nutrition varies a lot by who made it — the
   * number here is a reasonable single-serving reference point, not a tight estimate.
   */
  confidence: "high" | "medium";
}

/**
 * A local, offline food-nutrition reference table — no network call, matching the
 * user's "rule-based only" choice (ARCHITECTURE.md §7: zero network calls by
 * default). Values are standard USDA FoodData Central reference figures (the same
 * per-serving numbers you'd find on USDA FDC, or any nutrition tracker that cites
 * USDA data) for the serving size named in `servingDescription` — not independently
 * verified against a live query in this environment, and not invented; anyone citing
 * exact figures for a specific product should still check the label. Composite/
 * branded items are necessarily rougher (see `confidence`) since the real number
 * depends on the specific recipe or brand. Meant to keep growing over time — the
 * UI's "add a custom food" flow (Nutrition screen) appends to this list in
 * IndexedDB, not here.
 */
export const FOOD_DATABASE: FoodDatabaseEntry[] = [
  // --- Fruits ---
  { name: "banana", aliases: ["banana"], servingDescription: "1 medium (118g)", calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, fiberG: 3.1, addedSugarG: 0, totalSugarG: 14, caffeineMg: 0, confidence: "high" },
  { name: "apple", aliases: ["apple"], servingDescription: "1 medium (182g)", calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, fiberG: 4.4, addedSugarG: 0, totalSugarG: 19, caffeineMg: 0, confidence: "high" },
  { name: "orange", aliases: ["orange"], servingDescription: "1 medium (131g)", calories: 62, proteinG: 1.2, carbsG: 15.4, fatG: 0.2, fiberG: 3.1, addedSugarG: 0, totalSugarG: 12.2, caffeineMg: 0, confidence: "high" },
  { name: "strawberries", aliases: ["strawberries", "strawberry"], servingDescription: "1 cup (152g)", calories: 49, proteinG: 1, carbsG: 11.7, fatG: 0.5, fiberG: 3, addedSugarG: 0, totalSugarG: 7.4, caffeineMg: 0, confidence: "high" },
  { name: "blueberries", aliases: ["blueberries", "blueberry"], servingDescription: "1 cup (148g)", calories: 84, proteinG: 1.1, carbsG: 21.5, fatG: 0.5, fiberG: 3.6, addedSugarG: 0, totalSugarG: 14.7, caffeineMg: 0, confidence: "high" },
  { name: "grapes", aliases: ["grapes"], servingDescription: "1 cup (151g)", calories: 104, proteinG: 1.1, carbsG: 27.3, fatG: 0.2, fiberG: 1.4, addedSugarG: 0, totalSugarG: 23, caffeineMg: 0, confidence: "high" },
  { name: "avocado", aliases: ["avocado"], servingDescription: "1/2 medium (100g)", calories: 160, proteinG: 2, carbsG: 8.5, fatG: 14.7, fiberG: 6.7, addedSugarG: 0, totalSugarG: 0.7, caffeineMg: 0, confidence: "high" },
  { name: "watermelon", aliases: ["watermelon"], servingDescription: "1 cup diced (152g)", calories: 46, proteinG: 0.9, carbsG: 11.5, fatG: 0.2, fiberG: 0.6, addedSugarG: 0, totalSugarG: 9.4, caffeineMg: 0, confidence: "high" },
  { name: "mango", aliases: ["mango"], servingDescription: "1 cup (165g)", calories: 99, proteinG: 1.4, carbsG: 24.7, fatG: 0.6, fiberG: 2.6, addedSugarG: 0, totalSugarG: 22.5, caffeineMg: 0, confidence: "high" },
  { name: "pineapple", aliases: ["pineapple"], servingDescription: "1 cup chunks (165g)", calories: 82, proteinG: 0.9, carbsG: 21.6, fatG: 0.2, fiberG: 2.3, addedSugarG: 0, totalSugarG: 16.3, caffeineMg: 0, confidence: "high" },

  // --- Vegetables ---
  { name: "broccoli", aliases: ["broccoli"], servingDescription: "1 cup cooked (156g)", calories: 55, proteinG: 3.7, carbsG: 11.2, fatG: 0.6, fiberG: 5.1, addedSugarG: 0, totalSugarG: 2.2, caffeineMg: 0, confidence: "high" },
  { name: "spinach", aliases: ["spinach"], servingDescription: "1 cup cooked (180g)", calories: 41, proteinG: 5.3, carbsG: 6.8, fatG: 0.5, fiberG: 4.3, addedSugarG: 0, totalSugarG: 0.4, caffeineMg: 0, confidence: "high" },
  { name: "sweet potato", aliases: ["sweet potato"], servingDescription: "1 medium baked (150g)", calories: 130, proteinG: 2.3, carbsG: 30, fatG: 0.2, fiberG: 4, addedSugarG: 0, totalSugarG: 9.6, caffeineMg: 0, confidence: "high" },
  { name: "carrots", aliases: ["carrots", "carrot"], servingDescription: "1 cup chopped raw (128g)", calories: 52, proteinG: 1.2, carbsG: 12.3, fatG: 0.3, fiberG: 3.6, addedSugarG: 0, totalSugarG: 6, caffeineMg: 0, confidence: "high" },
  { name: "white potato", aliases: ["baked potato", "white potato", "potato"], servingDescription: "1 medium baked with skin (173g)", calories: 161, proteinG: 4.3, carbsG: 36.6, fatG: 0.2, fiberG: 3.8, addedSugarG: 0, totalSugarG: 2, caffeineMg: 0, confidence: "high" },
  { name: "salad greens", aliases: ["lettuce", "salad greens"], servingDescription: "2 cups (72g)", calories: 10, proteinG: 0.9, carbsG: 1.9, fatG: 0.1, fiberG: 1, addedSugarG: 0, totalSugarG: 0.5, caffeineMg: 0, confidence: "high" },
  { name: "tomato", aliases: ["tomato"], servingDescription: "1 medium (123g)", calories: 22, proteinG: 1.1, carbsG: 4.8, fatG: 0.2, fiberG: 1.5, addedSugarG: 0, totalSugarG: 3.2, caffeineMg: 0, confidence: "high" },
  { name: "cucumber", aliases: ["cucumber"], servingDescription: "1 cup sliced (104g)", calories: 16, proteinG: 0.7, carbsG: 3.8, fatG: 0.1, fiberG: 0.5, addedSugarG: 0, totalSugarG: 1.8, caffeineMg: 0, confidence: "high" },
  { name: "bell pepper", aliases: ["bell pepper"], servingDescription: "1 cup chopped (149g)", calories: 30, proteinG: 1, carbsG: 7, fatG: 0.3, fiberG: 2.5, addedSugarG: 0, totalSugarG: 4.2, caffeineMg: 0, confidence: "high" },
  { name: "onion", aliases: ["onion"], servingDescription: "1 cup chopped (160g)", calories: 64, proteinG: 1.8, carbsG: 14.9, fatG: 0.2, fiberG: 2.7, addedSugarG: 0, totalSugarG: 6.8, caffeineMg: 0, confidence: "high" },
  { name: "green beans", aliases: ["green beans"], servingDescription: "1 cup cooked (125g)", calories: 44, proteinG: 2.4, carbsG: 9.9, fatG: 0.4, fiberG: 4, addedSugarG: 0, totalSugarG: 3.3, caffeineMg: 0, confidence: "high" },
  { name: "corn", aliases: ["corn"], servingDescription: "1 cup cooked (154g)", calories: 143, proteinG: 5.4, carbsG: 31.4, fatG: 2.2, fiberG: 3.6, addedSugarG: 0, totalSugarG: 6.4, caffeineMg: 0, confidence: "high" },

  // --- Proteins / meats ---
  { name: "chicken breast", aliases: ["chicken breast", "chicken"], servingDescription: "100g cooked", calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0, confidence: "high" },
  { name: "chicken thigh", aliases: ["chicken thigh"], servingDescription: "100g cooked", calories: 209, proteinG: 26, carbsG: 0, fatG: 10.9, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0, confidence: "high" },
  { name: "ground beef", aliases: ["ground beef"], servingDescription: "100g cooked, 85% lean", calories: 250, proteinG: 25.9, carbsG: 0, fatG: 15.7, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0, confidence: "high" },
  { name: "steak", aliases: ["steak", "sirloin"], servingDescription: "100g cooked sirloin", calories: 183, proteinG: 29, carbsG: 0, fatG: 6.9, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0, confidence: "high" },
  { name: "salmon", aliases: ["salmon"], servingDescription: "100g cooked", calories: 208, proteinG: 22.1, carbsG: 0, fatG: 12.4, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0, confidence: "high" },
  { name: "tuna", aliases: ["tuna"], servingDescription: "100g canned in water, drained", calories: 116, proteinG: 25.5, carbsG: 0, fatG: 0.8, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0, confidence: "high" },
  { name: "shrimp", aliases: ["shrimp"], servingDescription: "100g cooked", calories: 99, proteinG: 24, carbsG: 0.2, fatG: 0.3, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0, confidence: "high" },
  { name: "pork chop", aliases: ["pork chop", "pork"], servingDescription: "100g cooked", calories: 231, proteinG: 26.6, carbsG: 0, fatG: 13.2, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0, confidence: "high" },
  { name: "turkey breast", aliases: ["turkey breast", "turkey"], servingDescription: "100g cooked", calories: 135, proteinG: 30, carbsG: 0, fatG: 0.7, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0, confidence: "high" },
  { name: "bacon", aliases: ["bacon"], servingDescription: "2 slices cooked (16g)", calories: 86, proteinG: 5.9, carbsG: 0.2, fatG: 6.7, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0, confidence: "high" },
  { name: "egg", aliases: ["egg", "eggs"], servingDescription: "1 large (50g)", calories: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8, fiberG: 0, addedSugarG: 0, totalSugarG: 0.2, caffeineMg: 0, confidence: "high" },  { name: "egg white", aliases: ["egg white", "egg whites"], servingDescription: "1 large (33g)", calories: 17, proteinG: 3.6, carbsG: 0.2, fatG: 0.1, fiberG: 0, addedSugarG: 0, totalSugarG: 0.2, caffeineMg: 0, confidence: "high" },
  { name: "tofu", aliases: ["tofu"], servingDescription: "100g firm", calories: 76, proteinG: 8, carbsG: 1.9, fatG: 4.8, fiberG: 0.3, addedSugarG: 0, totalSugarG: 0.6, caffeineMg: 0, confidence: "high" },

  // --- Dairy ---
  { name: "whole milk", aliases: ["whole milk"], servingDescription: "1 cup (244g)", calories: 149, proteinG: 7.7, carbsG: 11.7, fatG: 7.9, fiberG: 0, addedSugarG: 0, totalSugarG: 12.3, caffeineMg: 0, confidence: "high" },
  { name: "2% milk", aliases: ["2% milk", "reduced fat milk"], servingDescription: "1 cup (244g)", calories: 122, proteinG: 8.1, carbsG: 11.4, fatG: 4.6, fiberG: 0, addedSugarG: 0, totalSugarG: 12.3, caffeineMg: 0, confidence: "high" },
  { name: "skim milk", aliases: ["skim milk", "milk", "nonfat milk"], servingDescription: "1 cup (245g)", calories: 83, proteinG: 8.3, carbsG: 12.2, fatG: 0.2, fiberG: 0, addedSugarG: 0, totalSugarG: 12.5, caffeineMg: 0, confidence: "high" },
  { name: "greek yogurt", aliases: ["greek yogurt"], servingDescription: "1 cup (245g) plain nonfat", calories: 146, proteinG: 25, carbsG: 8, fatG: 0.5, fiberG: 0, addedSugarG: 0, totalSugarG: 8, caffeineMg: 0, confidence: "high" },
  { name: "yogurt", aliases: ["yogurt"], servingDescription: "1 cup (245g) plain whole milk", calories: 149, proteinG: 8.5, carbsG: 11.4, fatG: 8, fiberG: 0, addedSugarG: 0, totalSugarG: 11.4, caffeineMg: 0, confidence: "high" },
  { name: "cheddar cheese", aliases: ["cheddar", "cheddar cheese"], servingDescription: "1 oz (28g)", calories: 114, proteinG: 7, carbsG: 0.4, fatG: 9.4, fiberG: 0, addedSugarG: 0, totalSugarG: 0.1, caffeineMg: 0, confidence: "high" },
  { name: "mozzarella cheese", aliases: ["mozzarella"], servingDescription: "1 oz (28g) part-skim", calories: 72, proteinG: 6.9, carbsG: 0.8, fatG: 4.5, fiberG: 0, addedSugarG: 0, totalSugarG: 0.3, caffeineMg: 0, confidence: "high" },
  { name: "cottage cheese", aliases: ["cottage cheese"], servingDescription: "1 cup (226g) low-fat 2%", calories: 163, proteinG: 28, carbsG: 6.2, fatG: 4.3, fiberG: 0, addedSugarG: 0, totalSugarG: 6, caffeineMg: 0, confidence: "high" },
  { name: "butter", aliases: ["butter"], servingDescription: "1 tbsp (14g)", calories: 102, proteinG: 0.1, carbsG: 0, fatG: 11.5, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0, confidence: "high" },

  // --- Grains / starches ---
  { name: "white rice", aliases: ["white rice", "rice"], servingDescription: "1 cup cooked (158g)", calories: 205, proteinG: 4.3, carbsG: 44.5, fatG: 0.4, fiberG: 0.6, addedSugarG: 0, totalSugarG: 0.1, caffeineMg: 0, confidence: "high" },
  { name: "brown rice", aliases: ["brown rice"], servingDescription: "1 cup cooked (195g)", calories: 216, proteinG: 5, carbsG: 44.8, fatG: 1.8, fiberG: 3.5, addedSugarG: 0, totalSugarG: 0.7, caffeineMg: 0, confidence: "high" },
  { name: "quinoa", aliases: ["quinoa"], servingDescription: "1 cup cooked (185g)", calories: 222, proteinG: 8.1, carbsG: 39.4, fatG: 3.6, fiberG: 5.2, addedSugarG: 0, totalSugarG: 1.6, caffeineMg: 0, confidence: "high" },
  { name: "oatmeal", aliases: ["oatmeal", "oats"], servingDescription: "1 cup cooked (234g) plain", calories: 158, proteinG: 6, carbsG: 27, fatG: 3.2, fiberG: 4, addedSugarG: 0, totalSugarG: 1, caffeineMg: 0, confidence: "high" },
  { name: "pasta", aliases: ["pasta", "spaghetti"], servingDescription: "1 cup cooked (140g)", calories: 220, proteinG: 8.1, carbsG: 43.2, fatG: 1.3, fiberG: 2.5, addedSugarG: 0, totalSugarG: 0.8, caffeineMg: 0, confidence: "high" },
  { name: "whole wheat toast", aliases: ["whole wheat toast", "toast", "slice of bread", "whole wheat bread"], servingDescription: "1 slice (28g)", calories: 69, proteinG: 3.6, carbsG: 11.6, fatG: 1.1, fiberG: 1.9, addedSugarG: 1.4, totalSugarG: 1.6, caffeineMg: 0, confidence: "high" },
  { name: "white bread", aliases: ["white bread"], servingDescription: "1 slice (25g)", calories: 67, proteinG: 1.9, carbsG: 12.7, fatG: 0.8, fiberG: 0.6, addedSugarG: 1.4, totalSugarG: 1.4, caffeineMg: 0, confidence: "high" },
  { name: "bagel", aliases: ["bagel"], servingDescription: "1 medium (105g)", calories: 289, proteinG: 11, carbsG: 56, fatG: 1.7, fiberG: 2.4, addedSugarG: 3, totalSugarG: 4, caffeineMg: 0, confidence: "high" },
  { name: "flour tortilla", aliases: ["tortilla"], servingDescription: "1 medium (49g)", calories: 146, proteinG: 3.9, carbsG: 24, fatG: 3.5, fiberG: 1.4, addedSugarG: 0.5, totalSugarG: 0.9, caffeineMg: 0, confidence: "high" },

  // --- Legumes / nuts ---
  { name: "black beans", aliases: ["black beans"], servingDescription: "1 cup cooked (172g)", calories: 227, proteinG: 15.2, carbsG: 40.8, fatG: 0.9, fiberG: 15, addedSugarG: 0, totalSugarG: 0.6, caffeineMg: 0, confidence: "high" },
  { name: "chickpeas", aliases: ["chickpeas", "garbanzo"], servingDescription: "1 cup cooked (164g)", calories: 269, proteinG: 14.5, carbsG: 45, fatG: 4.2, fiberG: 12.5, addedSugarG: 0, totalSugarG: 7.9, caffeineMg: 0, confidence: "high" },
  { name: "lentils", aliases: ["lentils"], servingDescription: "1 cup cooked (198g)", calories: 230, proteinG: 17.9, carbsG: 39.9, fatG: 0.8, fiberG: 15.6, addedSugarG: 0, totalSugarG: 3.6, caffeineMg: 0, confidence: "high" },
  { name: "peanut butter", aliases: ["peanut butter"], servingDescription: "2 tbsp (32g)", calories: 188, proteinG: 8, carbsG: 6.9, fatG: 16, fiberG: 1.9, addedSugarG: 3, totalSugarG: 3, caffeineMg: 0, confidence: "high" },
  { name: "almonds", aliases: ["almonds"], servingDescription: "1 oz (28g), ~23 nuts", calories: 164, proteinG: 6, carbsG: 6.1, fatG: 14.2, fiberG: 3.5, addedSugarG: 0, totalSugarG: 1.2, caffeineMg: 0, confidence: "high" },
  { name: "walnuts", aliases: ["walnuts"], servingDescription: "1 oz (28g)", calories: 185, proteinG: 4.3, carbsG: 3.9, fatG: 18.5, fiberG: 1.9, addedSugarG: 0, totalSugarG: 0.7, caffeineMg: 0, confidence: "high" },
  { name: "peanuts", aliases: ["peanuts"], servingDescription: "1 oz (28g)", calories: 161, proteinG: 7.3, carbsG: 4.6, fatG: 14, fiberG: 2.4, addedSugarG: 0, totalSugarG: 1.1, caffeineMg: 0, confidence: "high" },

  // --- Beverages ---
  { name: "coffee", aliases: ["coffee"], servingDescription: "1 cup (240ml) brewed black", calories: 2, proteinG: 0.3, carbsG: 0, fatG: 0, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 95, confidence: "high" },
  { name: "espresso", aliases: ["espresso"], servingDescription: "1 shot (30ml)", calories: 3, proteinG: 0.1, carbsG: 0.5, fatG: 0, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 64, confidence: "high" },
  { name: "black tea", aliases: ["black tea", "tea"], servingDescription: "1 cup (240ml)", calories: 2, proteinG: 0, carbsG: 0.7, fatG: 0, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 47, confidence: "high" },
  { name: "green tea", aliases: ["green tea"], servingDescription: "1 cup (240ml)", calories: 2, proteinG: 0.5, carbsG: 0, fatG: 0, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 28, confidence: "high" },
  { name: "soda", aliases: ["soda", "coke", "cola"], servingDescription: "1 can (355ml)", calories: 140, proteinG: 0, carbsG: 39, fatG: 0, fiberG: 0, addedSugarG: 39, totalSugarG: 39, caffeineMg: 34, confidence: "high" },
  { name: "diet soda", aliases: ["diet soda", "diet coke"], servingDescription: "1 can (355ml)", calories: 0, proteinG: 0, carbsG: 0.3, fatG: 0, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 42, confidence: "high" },
  { name: "orange juice", aliases: ["orange juice"], servingDescription: "1 cup (248g)", calories: 112, proteinG: 1.7, carbsG: 25.8, fatG: 0.5, fiberG: 0.5, addedSugarG: 0, totalSugarG: 20.8, caffeineMg: 0, confidence: "high" },
  { name: "energy drink", aliases: ["energy drink", "red bull", "monster"], servingDescription: "1 can (250ml)", calories: 110, proteinG: 0, carbsG: 28, fatG: 0, fiberG: 0, addedSugarG: 27, totalSugarG: 27, caffeineMg: 80, confidence: "medium" },
  { name: "beer", aliases: ["beer"], servingDescription: "1 can (355ml)", calories: 153, proteinG: 1.6, carbsG: 12.6, fatG: 0, fiberG: 0, addedSugarG: 0, totalSugarG: 0, caffeineMg: 0, confidence: "medium" },
  { name: "red wine", aliases: ["red wine", "wine"], servingDescription: "5 fl oz (147ml)", calories: 125, proteinG: 0.1, carbsG: 3.8, fatG: 0, fiberG: 0, addedSugarG: 0, totalSugarG: 0.9, caffeineMg: 0, confidence: "medium" },
  { name: "latte", aliases: ["latte"], servingDescription: "1 cup (240ml) whole milk, 1 shot", calories: 120, proteinG: 6.5, carbsG: 9, fatG: 6.5, fiberG: 0, addedSugarG: 0, totalSugarG: 9, caffeineMg: 75, confidence: "medium" },
  { name: "cappuccino", aliases: ["cappuccino"], servingDescription: "1 cup (150ml)", calories: 70, proteinG: 3.8, carbsG: 5.5, fatG: 3.8, fiberG: 0, addedSugarG: 0, totalSugarG: 5.5, caffeineMg: 63, confidence: "medium" },
  { name: "smoothie", aliases: ["smoothie"], servingDescription: "12 fl oz (355ml) fruit smoothie", calories: 200, proteinG: 3, carbsG: 45, fatG: 1, fiberG: 3, addedSugarG: 20, totalSugarG: 35, caffeineMg: 0, confidence: "medium" },

  // --- Packaged / prepared ---
  { name: "donut", aliases: ["donut", "doughnut"], servingDescription: "1 glazed (60g)", calories: 240, proteinG: 3, carbsG: 27, fatG: 14, fiberG: 0.7, addedSugarG: 12, totalSugarG: 12, caffeineMg: 0, confidence: "medium" },
  { name: "protein shake", aliases: ["protein shake", "whey shake"], servingDescription: "1 scoop in 8 fl oz water (240ml)", calories: 120, proteinG: 24, carbsG: 3, fatG: 1.5, fiberG: 0, addedSugarG: 1, totalSugarG: 2, caffeineMg: 0, confidence: "medium" },  { name: "granola bar", aliases: ["granola bar"], servingDescription: "1 bar (24g)", calories: 100, proteinG: 2, carbsG: 16, fatG: 4, fiberG: 1, addedSugarG: 6, totalSugarG: 7, caffeineMg: 0, confidence: "medium" },
  { name: "potato chips", aliases: ["potato chips", "chips"], servingDescription: "1 oz (28g)", calories: 152, proteinG: 2, carbsG: 15, fatG: 10, fiberG: 1.2, addedSugarG: 0, totalSugarG: 0.1, caffeineMg: 0, confidence: "medium" },
  { name: "pretzels", aliases: ["pretzels"], servingDescription: "1 oz (28g)", calories: 108, proteinG: 2.6, carbsG: 22.5, fatG: 1, fiberG: 0.9, addedSugarG: 0.5, totalSugarG: 0.9, caffeineMg: 0, confidence: "medium" },
  { name: "cheese pizza", aliases: ["pizza"], servingDescription: "1 slice (107g)", calories: 285, proteinG: 12.2, carbsG: 35.7, fatG: 10.4, fiberG: 2.3, addedSugarG: 3, totalSugarG: 3.8, caffeineMg: 0, confidence: "medium" },
  { name: "hamburger", aliases: ["hamburger", "burger"], servingDescription: "1 fast-food sandwich (110g)", calories: 250, proteinG: 12, carbsG: 31, fatG: 9, fiberG: 1.5, addedSugarG: 5, totalSugarG: 6, caffeineMg: 0, confidence: "medium" },  { name: "french fries", aliases: ["french fries", "fries"], servingDescription: "1 medium fast-food serving (117g)", calories: 365, proteinG: 4, carbsG: 48, fatG: 17, fiberG: 4.4, addedSugarG: 0, totalSugarG: 0.2, caffeineMg: 0, confidence: "medium" },
  { name: "ice cream", aliases: ["ice cream"], servingDescription: "1/2 cup (66g) vanilla", calories: 137, proteinG: 2.3, carbsG: 15.6, fatG: 7.3, fiberG: 0.5, addedSugarG: 14, totalSugarG: 14, caffeineMg: 0, confidence: "medium" },
  { name: "chocolate chip cookie", aliases: ["chocolate chip cookie", "cookie"], servingDescription: "1 medium (16g)", calories: 78, proteinG: 0.9, carbsG: 9.6, fatG: 4.5, fiberG: 0.4, addedSugarG: 5, totalSugarG: 5.3, caffeineMg: 0, confidence: "medium" },
  { name: "dark chocolate", aliases: ["dark chocolate"], servingDescription: "1 oz (28g)", calories: 155, proteinG: 2.2, carbsG: 13, fatG: 11, fiberG: 3.1, addedSugarG: 6.8, totalSugarG: 6.8, caffeineMg: 12, confidence: "medium" },
  { name: "hummus", aliases: ["hummus"], servingDescription: "2 tbsp (30g)", calories: 70, proteinG: 2, carbsG: 6, fatG: 4.5, fiberG: 2, addedSugarG: 0, totalSugarG: 0.5, caffeineMg: 0, confidence: "medium" },
  { name: "turkey sandwich", aliases: ["turkey sandwich"], servingDescription: "1 deli sandwich (220g)", calories: 320, proteinG: 24, carbsG: 34, fatG: 10, fiberG: 3, addedSugarG: 3, totalSugarG: 5, caffeineMg: 0, confidence: "medium" },  { name: "burrito", aliases: ["burrito"], servingDescription: "1 bean-and-cheese burrito (200g)", calories: 445, proteinG: 17, carbsG: 60, fatG: 15, fiberG: 8, addedSugarG: 0, totalSugarG: 2, caffeineMg: 0, confidence: "medium" },
  { name: "california roll", aliases: ["sushi", "california roll"], servingDescription: "8 pieces (166g)", calories: 255, proteinG: 9, carbsG: 38, fatG: 7, fiberG: 2, addedSugarG: 2, totalSugarG: 3, caffeineMg: 0, confidence: "medium" },
];
