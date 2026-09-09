import { z } from "zod";
import { derivedMetricSchema } from "./common";

export const workoutSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(["apple_health", "strong", "manual"]),
  sourceWorkoutId: z.string().nullable(),
  workoutType: z.enum(["strength", "volleyball", "run", "other"]),
  startTime: z.string(),
  endTime: z.string().nullable(),
  durationMinutes: z.number(),
  activeCaloriesKcal: z.number().nullable(),
  totalCaloriesKcal: z.number().nullable(),
  averageHeartRate: z.number().nullable(),
  maxHeartRate: z.number().nullable(),
  hrZones: z
    .array(
      z.object({
        zone: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
        minutes: z.number(),
      }),
    )
    .nullable(),
  perceivedExertion: z.number().nullable(),
  notes: z.string().nullable(),
});
export type Workout = z.infer<typeof workoutSchema>;

export const strengthSetSchema = z.object({
  id: z.string().uuid(),
  orderIndex: z.number(),
  weightLb: z.number().nullable(),
  reps: z.number().nullable(),
  rir: z.number().nullable(),
  rpe: z.number().nullable(),
  restSeconds: z.number().nullable(),
  isPr: z.boolean(),
});
export type StrengthSet = z.infer<typeof strengthSetSchema>;

export const strengthExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  orderIndex: z.number(),
  sets: z.array(strengthSetSchema),
});
export type StrengthExercise = z.infer<typeof strengthExerciseSchema>;

export const strengthWorkoutSchema = z.object({
  workoutId: z.string().uuid(),
  exercises: z.array(strengthExerciseSchema),
});
export type StrengthWorkout = z.infer<typeof strengthWorkoutSchema>;

export const volleyballSessionSchema = z.object({
  workoutId: z.string().uuid(),
  format: z.enum(["6v6", "6v4", "beach", "other"]),
  activePlayMinutes: z.number().nullable(),
  passiveRestMinutes: z.number().nullable(),
  warmupActivity: z.string().nullable(),
  jumpVolume: z.enum(["low", "moderate", "high"]).nullable(),
  role: z.string().nullable(),
  appleActiveCaloriesKcal: z.number().nullable(),
  modelEstimate: derivedMetricSchema(z.number()).nullable(),
  notes: z.string().nullable(),
});
export type VolleyballSession = z.infer<typeof volleyballSessionSchema>;
