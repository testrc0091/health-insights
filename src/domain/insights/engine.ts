import type { DraftInsight, Insight } from "./types";

export type { DraftInsight, Insight } from "./types";

const CONFIDENCE_RANK: Record<Insight["confidence"], number> = {
  high: 3,
  moderate: 2,
  low: 1,
  exploratory: 0,
};

/** Highest confidence first, then largest absolute effect size — so the most
 * well-supported, most meaningful insights surface first wherever a screen shows a
 * ranked list (Today's priority card, Trends, the weekly report). */
export function rankInsights(insights: DraftInsight[]): DraftInsight[] {
  return [...insights].sort((a, b) => {
    const confidenceDiff = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
    if (confidenceDiff !== 0) return confidenceDiff;
    return Math.abs(b.effectSize ?? 0) - Math.abs(a.effectSize ?? 0);
  });
}

/** Brief's "≤3 high-value actions" rule for the weekly report, applied in exactly one
 * place rather than re-implemented by every caller. */
export function topInsights(insights: DraftInsight[], limit = 3): DraftInsight[] {
  return rankInsights(insights).slice(0, limit);
}

/**
 * The engine's pipeline shell: runs every analyzer thunk passed in, and — critically —
 * a single analyzer throwing (malformed input, a divide-by-zero edge case, etc.) never
 * takes down the rest of the pipeline. This is what lets the app-composition layer
 * wire up a dozen independent analyzers (each with its own narrow input type — see
 * domain/insights/analyzers/) without one broken analyzer blanking the whole Trends
 * screen. Each analyzer is a zero-argument closure so callers can bind their own
 * differently-shaped context at the call site instead of forcing every analyzer to
 * share one giant context type.
 */
export function runAnalyzers(analyzers: Array<() => DraftInsight[]>): DraftInsight[] {
  const results: DraftInsight[] = [];
  for (const analyze of analyzers) {
    try {
      results.push(...analyze());
    } catch {
      // Swallow — one bad analyzer must degrade to "no insight from it", not a crash.
    }
  }
  return rankInsights(results);
}

/** Convenience for analyzers that produce at most one insight (most of them) — turns
 * `T | null` into the `DraftInsight[]` shape `runAnalyzers` expects. */
export function single(insight: DraftInsight | null): DraftInsight[] {
  return insight ? [insight] : [];
}
