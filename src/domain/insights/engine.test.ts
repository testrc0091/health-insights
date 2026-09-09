import { describe, expect, it } from "vitest";
import { rankInsights, runAnalyzers, single, topInsights } from "./engine";
import type { DraftInsight } from "./types";

function draft(overrides: Partial<DraftInsight>): DraftInsight {
  return {
    kind: "observation",
    text: "test insight",
    domain: "nutrition",
    confidence: "low",
    sampleSize: { days: 1 },
    effectSize: 0,
    relatedEntityIds: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    algorithmVersion: "test.v1",
    ...overrides,
  };
}

describe("rankInsights", () => {
  it("orders by confidence tier first", () => {
    const low = draft({ confidence: "low", effectSize: 10 });
    const high = draft({ confidence: "high", effectSize: 1 });
    expect(rankInsights([low, high])).toEqual([high, low]);
  });

  it("breaks ties within a tier by absolute effect size", () => {
    const small = draft({ confidence: "moderate", effectSize: 1 });
    const large = draft({ confidence: "moderate", effectSize: -5 });
    expect(rankInsights([small, large])).toEqual([large, small]);
  });
});

describe("topInsights", () => {
  it("caps the list at the given limit (brief's <=3 rule)", () => {
    const insights = [1, 2, 3, 4, 5].map((n) => draft({ confidence: "moderate", effectSize: n }));
    expect(topInsights(insights, 3)).toHaveLength(3);
    expect(topInsights(insights)).toHaveLength(3); // default limit
  });
});

describe("runAnalyzers", () => {
  it("collects results from every analyzer that succeeds", () => {
    const results = runAnalyzers([
      () => single(draft({ text: "a" })),
      () => single(draft({ text: "b" })),
    ]);
    expect(results.map((r) => r.text).sort()).toEqual(["a", "b"]);
  });

  it("swallows an analyzer that throws instead of failing the whole pipeline", () => {
    const results = runAnalyzers([
      () => {
        throw new Error("boom");
      },
      () => single(draft({ text: "survives" })),
    ]);
    expect(results.map((r) => r.text)).toEqual(["survives"]);
  });
});
