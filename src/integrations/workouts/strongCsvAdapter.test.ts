import { describe, expect, it } from "vitest";
import { parseStrongCsv, parseStrongExport } from "./strongCsvAdapter";

const CSV_HEADER = "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE";

describe("parseStrongCsv", () => {
  it("parses a well-formed CSV export into one workout per session", () => {
    const csv = [
      CSV_HEADER,
      '2026-09-20 10:00:00,Push Day,45m,Bench Press,1,135,10,,,,,',
      '2026-09-20 10:00:00,Push Day,45m,Bench Press,2,135,8,,,,,',
    ].join("\n");
    const { workouts, strengthWorkouts, warnings } = parseStrongCsv(csv);
    expect(warnings).toEqual([]);
    expect(workouts).toHaveLength(1);
    expect(strengthWorkouts[0]!.exercises[0]!.sets).toHaveLength(2);
  });

  it("warns instead of throwing when the header doesn't look like a Strong export", () => {
    const { workouts, warnings } = parseStrongCsv("not,a,strong,export\n1,2,3,4");
    expect(workouts).toEqual([]);
    expect(warnings[0]).toContain("doesn't look like a Strong export");
  });
});

describe("parseStrongExport", () => {
  // Regression: a real "Share" export from the Strong app (the app's Share button on
  // a finished workout) was rejected by the CSV parser with "doesn't look like a
  // Strong export" and silently produced zero workouts - this is Strong's OTHER export
  // format (per-workout share text, not the full-history CSV from Settings), which
  // needed its own parser rather than being misdiagnosed as bad CSV input.
  const REAL_SHARE_TEXT = `Glutes
Tuesday, September 22, 2026 at 11:44 AM

Banded lateral walks
Set 1: 10 reps

Monster walks
Set 1: 10 reps

Hip Thrust (Barbell)
Set 1: 225 lb × 10
Set 2: 225 lb × 10
Set 3: 225 lb × 9

Romanian Deadlift (Dumbbell)
Set 1: 50 lb × 8
Set 2: 45 lb × 10
Set 3: 45 lb × 10

Notes: Grip issue, felt in lower back may consider backing off to lighter

Step ups
Set 1: 70 lb × 10
Set 2: 70 lb × 10
Set 3: 70 lb × 15

Hamstring curl
Set 1: 100 lb × 10
Set 2: 105 lb × 9
Set 3: 105 lb × 10
https://link.strong.app/rdpauyva`;

  it("parses a real Strong 'Share' export end to end", () => {
    const { workouts, strengthWorkouts, warnings } = parseStrongExport(REAL_SHARE_TEXT);
    expect(warnings).toEqual([]);
    expect(workouts).toHaveLength(1);
    expect(workouts[0]!.workoutType).toBe("strength");
    expect(workouts[0]!.source).toBe("strong");

    const exercises = strengthWorkouts[0]!.exercises;
    expect(exercises.map((e) => e.name)).toEqual([
      "Banded lateral walks",
      "Monster walks",
      "Hip Thrust (Barbell)",
      "Romanian Deadlift (Dumbbell)",
      "Step ups",
      "Hamstring curl",
    ]);

    const hipThrust = exercises.find((e) => e.name === "Hip Thrust (Barbell)")!;
    expect(hipThrust.sets).toHaveLength(3);
    expect(hipThrust.sets[0]).toMatchObject({ weightLb: 225, reps: 10 });
    expect(hipThrust.sets[2]).toMatchObject({ weightLb: 225, reps: 9 });

    const bandedWalks = exercises.find((e) => e.name === "Banded lateral walks")!;
    expect(bandedWalks.sets[0]).toMatchObject({ weightLb: null, reps: 10 });

    // The share-link line must not become a 7th "exercise."
    expect(exercises.some((e) => e.name.includes("strong.app"))).toBe(false);

    // "Notes:" has no dedicated per-exercise field in the data model, so it's folded
    // into the workout-level notes, prefixed with which exercise it followed.
    expect(workouts[0]!.notes).toContain("Romanian Deadlift");
    expect(workouts[0]!.notes).toContain("Grip issue");
  });

  it("parses the share text's date correctly regardless of the runtime's Date parser leniency", () => {
    const { workouts } = parseStrongExport(REAL_SHARE_TEXT);
    const parsed = new Date(workouts[0]!.startTime);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8); // September, 0-indexed
    expect(parsed.getDate()).toBe(22);
    expect(parsed.getHours()).toBe(11);
    expect(parsed.getMinutes()).toBe(44);
  });

  it("still uses the CSV parser (and its own warning) for real CSV input", () => {
    const csv = [CSV_HEADER, '2026-09-20 10:00:00,Push Day,45m,Bench Press,1,135,10,,,,,'].join("\n");
    const { workouts, warnings } = parseStrongExport(csv);
    expect(workouts).toHaveLength(1);
    expect(warnings).toEqual([]);
  });

  it("falls back to the CSV parser's warning for input that matches neither format", () => {
    const { workouts, warnings } = parseStrongExport("just some random pasted text\nwith no structure at all");
    expect(workouts).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
