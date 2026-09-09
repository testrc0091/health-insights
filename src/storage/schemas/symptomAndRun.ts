import { z } from "zod";
import { isoDateSchema } from "./common";

export const symptomEntrySchema = z.object({
  id: z.string().uuid(),
  dateTime: z.string(),
  bodyArea: z.string(),
  symptomType: z.enum([
    "pain",
    "tightness",
    "snapping",
    "numbness",
    "soreness",
    "swelling",
    "stiffness",
    "headache",
    "fatigue",
    "other",
  ]),
  severity: z.number().min(0).max(10),
  laterality: z.enum(["left", "right", "bilateral", "n/a"]),
  trigger: z.string().nullable(),
  durationMinutes: z.number().nullable(),
  impactOnTraining: z.enum(["none", "modified", "shortened", "skipped"]).nullable(),
  notes: z.string().nullable(),
  flaggedForReview: z.boolean(),
});
export type SymptomEntry = z.infer<typeof symptomEntrySchema>;

export const runIntervalSchema = z.object({
  type: z.enum(["walk", "run"]),
  minutes: z.number(),
  symptomsDuring: z.string().nullable(),
});
export type RunInterval = z.infer<typeof runIntervalSchema>;

export const runSessionSchema = z.object({
  id: z.string().uuid(),
  date: isoDateSchema,
  workoutId: z.string().uuid().nullable(),
  protocol: z.string(),
  intervals: z.array(runIntervalSchema),
  distanceMiles: z.number().nullable(),
  paceMinPerMile: z.number().nullable(),
  averageHeartRate: z.number().nullable(),
  symptomsAfter: z.string().nullable(),
  nextDaySymptoms: z.string().nullable(),
  progressionStatus: z.enum(["green", "yellow", "red"]).nullable(),
});
export type RunSession = z.infer<typeof runSessionSchema>;
