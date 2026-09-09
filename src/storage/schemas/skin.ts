import { z } from "zod";
import { isoDateSchema, rating0to3Schema, rating0to4Schema } from "./common";

export const skinEntrySchema = z.object({
  id: z.string().uuid(),
  date: isoDateSchema,
  acneSeverity: rating0to4Schema,
  breakoutAreas: z.array(z.string()),
  lesionType: z.string().nullable(),
  dryness: rating0to3Schema.nullable(),
  irritation: rating0to3Schema.nullable(),
  photoBlobId: z.string().nullable(),
  skincareProductsUsed: z.array(z.string()),
  notes: z.string().nullable(),
});
export type SkinEntry = z.infer<typeof skinEntrySchema>;

export const skincareChangeSchema = z.object({
  id: z.string().uuid(),
  date: isoDateSchema,
  product: z.string(),
  action: z.enum(["started", "stopped"]),
  reason: z.string().nullable(),
});
export type SkincareChange = z.infer<typeof skincareChangeSchema>;
