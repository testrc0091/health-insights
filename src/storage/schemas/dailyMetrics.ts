import { z } from "zod";
import { isoDateSchema, rating1to5Schema } from "./common";

export const dailyMetricsSchema = z.object({
  id: z.string().uuid(),
  date: isoDateSchema,
  weightLb: z.number().nullable(),
  steps: z.number().nullable(),
  restingHeartRate: z.number().nullable(),
  sleepDurationMinutes: z.number().nullable(),
  sleepQuality: rating1to5Schema,
  activeEnergyKcal: z.number().nullable(),
  totalEnergyKcal: z.number().nullable(),
  perceivedEnergy: rating1to5Schema,
  hunger: rating1to5Schema,
  soreness: rating1to5Schema,
  stress: rating1to5Schema,
  mood: rating1to5Schema,
  notes: z.string().nullable(),
});

export type DailyMetrics = z.infer<typeof dailyMetricsSchema>;
