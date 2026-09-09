import { z } from "zod";
import { confidenceTierSchema, isoDateSchema, isoDateTimeSchema } from "./common";

export const insightSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["observation", "correlation", "hypothesis", "recommendation"]),
  text: z.string(),
  domain: z.enum(["nutrition", "training", "recovery", "cycle", "skin", "symptoms", "mood"]),
  confidence: confidenceTierSchema,
  sampleSize: z.object({
    cycles: z.number().optional(),
    sessions: z.number().optional(),
    days: z.number().optional(),
  }),
  effectSize: z.number().nullable(),
  relatedEntityIds: z.array(z.string()),
  generatedAt: isoDateTimeSchema,
  algorithmVersion: z.string(),
});
export type InsightRecord = z.infer<typeof insightSchema>;

export const weeklyReportSchema = z.object({
  id: z.string().uuid(),
  weekStartDate: isoDateSchema,
  nutritionSummary: z.object({
    avgCalories: z.number(),
    avgProteinG: z.number(),
    avgFiberG: z.number(),
    avgCarbsG: z.number(),
    targetAdherencePct: z.number(),
  }),
  trainingSummary: z.object({
    liftingSessions: z.number(),
    volleyballMinutes: z.number(),
    avgSteps: z.number(),
    trainingLoadScore: z.number(),
  }),
  weightSummary: z.object({
    sevenDayAvg: z.number(),
    trendSlopePerWeek: z.number(),
  }),
  recoverySummary: z.object({
    avgSleepMinutes: z.number(),
    avgRestingHeartRate: z.number().nullable(),
    avgSoreness: z.number().nullable(),
    avgEnergy: z.number().nullable(),
  }),
  cycleSummary: z.object({
    cycleDay: z.number().nullable(),
    periodStatus: z.string().nullable(),
    notablePatterns: z.array(z.string()),
  }),
  skinSummary: z.object({
    acneTrend: z.enum(["improving", "stable", "worsening", "insufficient_data"]),
  }),
  topRecommendations: z.array(insightSchema),
  generatedAt: isoDateTimeSchema,
});
export type WeeklyReport = z.infer<typeof weeklyReportSchema>;
