import { describe, expect, it } from "vitest";
import { cycleDayForDate, describePhase, estimateCycleWindow, phaseForDate } from "./phaseEstimation";

describe("estimateCycleWindow", () => {
  it("computes ovulation as cycleLength - lutealLength days after period start (28/14 default)", () => {
    const window = estimateCycleWindow({
      periodStartDate: "2026-03-01",
      periodLengthDays: 5,
      averageCycleLengthDays: 28,
      averageLutealLengthDays: 14,
    });
    // day 1 + (28-14) = day 15 -> 2026-03-15
    expect(window.estimatedOvulationDate).toBe("2026-03-15");
    expect(window.follicularRange).toEqual({ start: "2026-03-01", end: "2026-03-14" });
    expect(window.lutealRange).toEqual({ start: "2026-03-15", end: "2026-03-28" });
  });

  it("respects a shorter personal cycle length once known from history", () => {
    const window = estimateCycleWindow({
      periodStartDate: "2026-03-01",
      periodLengthDays: 4,
      averageCycleLengthDays: 24,
      averageLutealLengthDays: 12,
    });
    expect(window.estimatedOvulationDate).toBe("2026-03-13"); // day 1 + (24-12) = day 13
  });
});

describe("phaseForDate", () => {
  const window = estimateCycleWindow({
    periodStartDate: "2026-03-01",
    periodLengthDays: 5,
    averageCycleLengthDays: 28,
    averageLutealLengthDays: 14,
  });

  it("labels days within the period as menstrual", () => {
    expect(phaseForDate("2026-03-03", "2026-03-01", 5, window)).toBe("menstrual");
  });

  it("labels days between period end and ovulation as follicular", () => {
    expect(phaseForDate("2026-03-10", "2026-03-01", 5, window)).toBe("follicular");
  });

  it("labels the day of estimated ovulation (+/- 1 day) as ovulatory", () => {
    expect(phaseForDate("2026-03-15", "2026-03-01", 5, window)).toBe("ovulatory");
    expect(phaseForDate("2026-03-14", "2026-03-01", 5, window)).toBe("ovulatory");
  });

  it("labels days after ovulation as luteal", () => {
    expect(phaseForDate("2026-03-25", "2026-03-01", 5, window)).toBe("luteal");
  });
});

describe("cycleDayForDate", () => {
  it("counts the period start date itself as cycle day 1", () => {
    expect(cycleDayForDate("2026-03-01", "2026-03-01")).toBe(1);
  });

  it("counts forward correctly across the month", () => {
    expect(cycleDayForDate("2026-03-15", "2026-03-01")).toBe(15);
  });
});

describe("describePhase", () => {
  it("shows a bare label only at high confidence", () => {
    expect(describePhase("luteal", "high")).toBe("Luteal");
  });

  it("qualifies the label as an estimate at medium/low confidence", () => {
    expect(describePhase("luteal", "medium")).toBe("Estimated luteal (medium confidence)");
    expect(describePhase("luteal", "low")).toBe("Estimated luteal (low confidence)");
  });
});
