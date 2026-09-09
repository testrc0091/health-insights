import type { ConfidenceTier, ISODateTime } from "../models/common";

export type InsightKind = "observation" | "correlation" | "hypothesis" | "recommendation";
export type InsightDomain = "nutrition" | "training" | "recovery" | "cycle" | "skin" | "symptoms" | "mood";

export interface Insight {
  id: string;
  kind: InsightKind;
  text: string;
  domain: InsightDomain;
  confidence: ConfidenceTier;
  sampleSize: { cycles?: number; sessions?: number; days?: number };
  effectSize: number | null;
  relatedEntityIds: string[];
  generatedAt: ISODateTime;
  algorithmVersion: string;
}

/**
 * What every analyzer in domain/insights/analyzers/ actually returns. Analyzers are
 * pure functions — they don't generate IDs (that would make them impure/hard to test
 * deterministically) — the app-composition layer assigns a UUID when persisting one of
 * these as a real `Insight` row.
 */
export type DraftInsight = Omit<Insight, "id">;
