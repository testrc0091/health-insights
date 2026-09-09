import { describe, expect, it } from "vitest";
import { resolvePriorityToday } from "./priorityToday";

describe("resolvePriorityToday", () => {
  it("matches the brief's worked example: protein sufficient, prioritize carbs + calories", () => {
    const result = resolvePriorityToday({
      activityType: "volleyball",
      nutrients: [
        { label: "protein", targetAmount: 120, consumedAmount: 115 }, // ~4% remaining -> sufficient
        { label: "carbs", targetAmount: 300, consumedAmount: 80 }, // ~73% remaining -> priority
        { label: "calories", targetAmount: 2850, consumedAmount: 1200 }, // ~58% remaining -> priority
        { label: "fiber", targetAmount: 30, consumedAmount: 28 }, // ~7% remaining -> sufficient
      ],
    });

    expect(result.sufficientLabels).toEqual(expect.arrayContaining(["protein", "fiber"]));
    expect(result.priorityLabels[0]).toBe("carbs");
    expect(result.headline).toContain("prioritize carbohydrate");
  });

  it("reports on-track when every nutrient is near target", () => {
    const result = resolvePriorityToday({
      activityType: "lifting",
      nutrients: [{ label: "protein", targetAmount: 120, consumedAmount: 120 }],
    });
    expect(result.priorityLabels).toEqual([]);
    expect(result.headline).toContain("on track");
  });

  it("falls back to an activity note when nothing has been logged", () => {
    const result = resolvePriorityToday({
      activityType: "rest",
      nutrients: [],
    });
    expect(result.headline).toContain("rest day");
  });
});
