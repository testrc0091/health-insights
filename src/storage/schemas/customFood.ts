import { z } from "zod";

/**
 * A user-added or user-edited entry in the nutrition parser's food list, stored in
 * IndexedDB rather than the static seed table (foodDatabase.ts) — so logging "a food
 * with no existing info" (or fixing one that's wrong) doesn't require a code change.
 * Shape mirrors `FoodDatabaseEntry` plus the bookkeeping fields a persisted row needs.
 * nutritionParser.ts's `parseNutritionText` takes these as an optional list and checks
 * them ahead of the built-in database, so a custom entry for an existing food name
 * (e.g. "ribeye steak") overrides the built-in one rather than just adding a duplicate.
 */
export const customFoodSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  /** Lowercase match strings, same whole-word matching rule as the built-in database. */
  aliases: z.array(z.string().min(1)).min(1),
  servingDescription: z.string().min(1),
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  fiberG: z.number(),
  addedSugarG: z.number().nullable(),
  totalSugarG: z.number().nullable(),
  caffeineMg: z.number().nullable(),
  confidence: z.enum(["high", "medium"]),
  createdAt: z.string(),
});
export type CustomFood = z.infer<typeof customFoodSchema>;
