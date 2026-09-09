import { z } from "zod";
import { cyclePhaseConfidenceSchema, derivedMetricSchema, isoDateSchema, rating0to10Schema } from "./common";

export const menstrualCycleEntrySchema = z.object({
  id: z.string().uuid(),
  date: isoDateSchema,
  bleeding: z.enum(["none", "spotting", "light", "medium", "heavy"]),
  periodStart: z.boolean(),
  periodEnd: z.boolean(),
  cramps: rating0to10Schema,
  breastTenderness: rating0to10Schema,
  bloating: rating0to10Schema,
  headache: rating0to10Schema,
  fatigue: rating0to10Schema,
  mood: rating0to10Schema,
  irritability: rating0to10Schema,
  cravings: z.array(z.string()).nullable(),
  hunger: rating0to10Schema,
  sleepDisruption: rating0to10Schema,
  giSymptoms: z.array(z.string()).nullable(),
  acneFlare: z.boolean().nullable(),
  libido: rating0to10Schema,
  cervicalMucus: z.string().nullable(),
  ovulationTestResult: z.enum(["positive", "negative", "not_tested"]).nullable(),
  basalBodyTempF: z.number().nullable(),
  notes: z.string().nullable(),
});
export type MenstrualCycleEntry = z.infer<typeof menstrualCycleEntrySchema>;

export const cycleSchema = z.object({
  id: z.string().uuid(),
  startDate: isoDateSchema,
  endDate: isoDateSchema.nullable(),
  cycleLengthDays: z.number().nullable(),
  periodLengthDays: z.number().nullable(),
  estimatedOvulationDate: derivedMetricSchema(isoDateSchema).nullable(),
  follicularPhaseRange: z.object({ start: isoDateSchema, end: isoDateSchema }).nullable(),
  lutealPhaseRange: z.object({ start: isoDateSchema, end: isoDateSchema }).nullable(),
  phaseConfidence: cyclePhaseConfidenceSchema,
  isRegular: z.boolean().nullable(),
  algorithmVersion: z.string(),
});
export type Cycle = z.infer<typeof cycleSchema>;
