import { z } from "zod";
import { isoDateSchema } from "./common";

export const measurementTypeSchema = z.enum([
  "waist",
  "hips",
  "neck",
  "chest",
  "shoulders",
  "upper_arm",
  "forearm",
  "thigh",
  "calf",
  "custom",
]);

export const bodyMeasurementSchema = z.object({
  id: z.string().uuid(),
  date: isoDateSchema,
  measurementType: measurementTypeSchema,
  customLabel: z.string().nullable(),
  side: z.enum(["left", "right", "n/a"]),
  valueCm: z.number(),
  photoBlobId: z.string().nullable(),
  notes: z.string().nullable(),
});

export type BodyMeasurement = z.infer<typeof bodyMeasurementSchema>;
export type MeasurementType = z.infer<typeof measurementTypeSchema>;
