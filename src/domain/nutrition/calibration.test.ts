import { describe, expect, it } from "vitest";
import { calibrateCalorieTarget } from "./calibration";

describe("calibrateCalorieTarget", () => {
  it("does not calibrate with fewer than 3 weeks of data", () => {
    const result = calibrateCalorieTarget({
      goalDirection: "gain",
      weeklyAvgWeightLb: [128, 128.2],
      estimatedTarget: 2500,
    });
    expect(result.recommendedAdjustmentKcal).toBe(0);
    expect(result.calibratedTarget).toBe(2500);
  });

  it("recommends no change when gaining and weight is trending up toward the goal", () => {
    const result = calibrateCalorieTarget({
      goalDirection: "gain",
      weeklyAvgWeightLb: [128, 128.7, 129.5],
      estimatedTarget: 2500,
    });
    expect(result.recommendedAdjustmentKcal).toBe(0);
  });

  it("recommends a +125 kcal/day adjustment when trying to gain but weight is flat", () => {
    const result = calibrateCalorieTarget({
      goalDirection: "gain",
      weeklyAvgWeightLb: [128, 128.1, 128.0],
      estimatedTarget: 2500,
    });
    expect(result.recommendedAdjustmentKcal).toBe(125);
    expect(result.calibratedTarget).toBe(2625);
  });

  it("recommends a -125 kcal/day adjustment when trying to lose but weight is flat", () => {
    const result = calibrateCalorieTarget({
      goalDirection: "lose",
      weeklyAvgWeightLb: [150, 150.1, 149.9],
      estimatedTarget: 2200,
    });
    expect(result.recommendedAdjustmentKcal).toBe(-125);
    expect(result.calibratedTarget).toBe(2075);
  });

  it("recommends no change for a maintain goal when weight is stable", () => {
    const result = calibrateCalorieTarget({
      goalDirection: "maintain",
      weeklyAvgWeightLb: [140, 140.2, 139.9],
      estimatedTarget: 2400,
    });
    expect(result.recommendedAdjustmentKcal).toBe(0);
  });

  it("recommends a downward adjustment for a maintain goal when weight has risen", () => {
    const result = calibrateCalorieTarget({
      goalDirection: "maintain",
      weeklyAvgWeightLb: [140, 140.8, 141.6],
      estimatedTarget: 2400,
    });
    expect(result.recommendedAdjustmentKcal).toBe(-125);
  });
});
