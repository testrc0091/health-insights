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
});
export type FoodEntry = z.infer<typeof foodEntrySchema>;
