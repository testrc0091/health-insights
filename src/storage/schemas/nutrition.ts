import { z } from "zod";
import { isoDateSchema } from "./common";

export const nutritionDaySchema = z.object({
  id: z.string().uuid(),
  date: isoDateSchema,
  calorieTarget: z.number(),
  proteinTargetG: z.number(),
  fiberTargetG: z.number(),
  carbTargetG: z.number().nullable(),
  fatTargetG: z.number().nullable(),
  targetSource: z.enum(["estimated", "calibrated", "manual_override"]),
});
export type NutritionDay = z.infer<typeof nutritionDaySchema>;

export const parsedFoodItemSchema = z.object({
  name: z.string(),
  calories: z.number(),
  calorieRangeLow: z.number().nullable(),
  calorieRangeHigh: z.number().nullable(),
  proteinG: z.number(),
  carbsG: z.number().nullable(),
  fatG: z.number().nullable(),
  fiberG: z.number(),
  addedSugarG: z.number().nullable(),
  totalSugarG: z.number().nullable(),
  caffeineMg: z.number().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
});
export type ParsedFoodItem = z.infer<typeof parsedFoodItemSchema>;

export const foodEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  date: isoDateSchema,
  rawText: z.string().nullable(),
  parsedFoods: z.array(parsedFoodItemSchema),
  source: z.enum(["manual", "restaurant_estimate", "packaged_nutrition", "photo", "ai_parsed"]),
  notes: z.string().nullable(),
  /** An optional reference photo (e.g. a screenshot from another nutrition app's
   * summary screen) stored via photoBlobRepository, never OCR'd or analyzed — this
   * app never makes network calls (ARCHITECTURE.md §7), so a photo can only ever be
   * kept for the user's own reference, not turned into numbers automatically. */
  photoBlobId: z.string().nullable(),
});
export type FoodEntry = z.infer<typeof foodEntrySchema>;
