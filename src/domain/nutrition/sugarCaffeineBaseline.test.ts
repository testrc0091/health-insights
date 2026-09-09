import { describe, expect, it } from "vitest";
import { flagUnusualIntakeDays, type DailyIntakeTotal } from "./sugarCaffeineBaseline";

function day(date: string, caffeineMg: number): DailyIntakeTotal {
  return { date, addedSugarG: 20, totalSugarG: 30, caffeineMg };
}

describe("flagUnusualIntakeDays", () => {
  it("does not flag when today is close to a stable baseline", () => {
    const history = ["01", "02", "03", "04", "05"].map((d) => day(`2026-01-${d}`, 100));
    const today = day("2026-01-06", 110);
    const flags = flagUnusualIntakeDays(history, today);
    const caffeine = flags.find((f) => f.metric === "caffeineMg")!;
    expect(caffeine.isUnusuallyHigh).toBe(false);
  });

  it("flags a day well above the personal baseline", () => {
    const history = ["01", "02", "03", "04", "05"].map((d) => day(`2026-01-${d}`, 100));
    const today = day("2026-01-06", 500);
    const flags = flagUnusualIntakeDays(history, today);
    const caffeine = flags.find((f) => f.metric === "caffeineMg")!;
    expect(caffeine.isUnusuallyHigh).toBe(true);
    expect(caffeine.sampleSizeDays).toBe(5);
  });

  it("never flags with fewer than 2 days of baseline history", () => {
    const flags = flagUnusualIntakeDays([day("2026-01-05", 100)], day("2026-01-06", 900));
    expect(flags.every((f) => !f.isUnusuallyHigh)).toBe(true);
  });
});
