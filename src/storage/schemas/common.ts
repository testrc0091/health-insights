import { z } from "zod";

/** Date-only fields must be "YYYY-MM-DD" — every adapter/UI form formats through
 * domain/dateUtils.ts's toIsoDate rather than handing this schema a raw Date. */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** Full timestamps are trusted to be ISO-ish strings (usually `Date.toISOString()`);
 * kept loose deliberately so imported data (Apple Health export, Strong CSV) that's
 * already been normalized upstream isn't rejected on a strict format technicality. */
export const isoDateTimeSchema = z.string().min(1);

export const confidenceTierSchema = z.enum(["exploratory", "low", "moderate", "high"]);
export const cyclePhaseConfidenceSchema = z.enum(["high", "medium", "low"]);
export const activityTypeSchema = z.enum(["lifting", "volleyball", "recovery", "rest", "other"]);
export const dayOfWeekSchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export const dayOfWeekPlanSchema = z.object({
  day: dayOfWeekSchema,
  activityType: activityTypeSchema,
  calorieTarget: z.number().nullable(),
});

export function derivedMetricSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    name: z.string(),
    value: valueSchema,
    rangeLow: valueSchema.optional(),
    rangeHigh: valueSchema.optional(),
    confidence: confidenceTierSchema,
    sources: z.array(z.string()),
    algorithmVersion: z.string(),
    computedAt: isoDateTimeSchema,
  });
}

export const rating0to3Schema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export const rating0to4Schema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export const rating1to5Schema = z
  .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
  .nullable();
export const rating0to10Schema = z.number().min(0).max(10).nullable();
