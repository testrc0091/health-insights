import { v4 as uuid } from "uuid";
import { toIsoDate } from "../../domain/dateUtils";
import type { Workout } from "../../storage/schemas/workout";
import type { DailyMetrics } from "../../storage/schemas/dailyMetrics";

export interface AppleHealthImportResult {
  workouts: Workout[];
  dailyMetrics: DailyMetrics[];
  warnings: string[];
}

const WORKOUT_TYPE_MAP: Record<string, Workout["workoutType"]> = {
  HKWorkoutActivityTypeTraditionalStrengthTraining: "strength",
  HKWorkoutActivityTypeFunctionalStrengthTraining: "strength",
  HKWorkoutActivityTypeVolleyball: "volleyball",
  HKWorkoutActivityTypeRunning: "run",
};

const KG_TO_LB = 2.20462;

function parseAppleDate(raw: string): Date {
  // Apple's export format ("2026-01-05 08:12:00 -0500") parses correctly via the
  // native Date constructor — no custom format parsing needed.
  return new Date(raw);
}

function numOrNull(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function average(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Parses an Apple Health "export.xml" (Settings > Health > profile icon > Export All
 * Health Data, then unzip) entirely client-side — no network call, matching the
 * user's manual-import choice (ARCHITECTURE.md §2, option 1). Uses the browser's
 * native DOMParser rather than an added XML-parsing dependency. Multi-year Apple
 * Watch exports can be very large (hundreds of MB); parsing may take several seconds
 * for those — documented as a known limitation in README, not silently hidden.
 */
export function parseAppleHealthExport(xmlText: string): AppleHealthImportResult {
  const warnings: string[] = [];
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");

  if (doc.querySelector("parsererror")) {
    return {
      workouts: [],
      dailyMetrics: [],
      warnings: ["Could not parse this file as Apple Health export XML."],
    };
  }

  const workouts = parseWorkouts(doc, warnings);
  const dailyMetrics = parseDailyMetrics(doc, warnings);
  return { workouts, dailyMetrics, warnings };
}

function parseWorkouts(doc: Document, warnings: string[]): Workout[] {
  const nodes = Array.from(doc.querySelectorAll("Workout"));
  const workouts: Workout[] = [];

  for (const node of nodes) {
    const activityType = node.getAttribute("workoutActivityType") ?? "";
    const startDateRaw = node.getAttribute("startDate");
    const endDateRaw = node.getAttribute("endDate");
    if (!startDateRaw) {
      warnings.push("Skipped a Workout record with no startDate.");
      continue;
    }

    const totalCalories = numOrNull(node.getAttribute("totalEnergyBurned"));
    workouts.push({
      id: uuid(),
      source: "apple_health",
      // Apple exports don't carry a stable per-workout ID, so (startDate, type) is the
      // dedup key instead — two real sessions never share the exact same start second.
      sourceWorkoutId: `${startDateRaw}|${activityType}`,
      workoutType: WORKOUT_TYPE_MAP[activityType] ?? "other",
      startTime: parseAppleDate(startDateRaw).toISOString(),
      endTime: endDateRaw ? parseAppleDate(endDateRaw).toISOString() : null,
      durationMinutes: Number(node.getAttribute("duration") ?? "0"),
      activeCaloriesKcal: totalCalories,
      totalCaloriesKcal: totalCalories,
      averageHeartRate: null,
      maxHeartRate: null,
      hrZones: null,
      perceivedExertion: null,
      notes: activityType.replace("HKWorkoutActivityType", "") || null,
    });
  }

  return workouts;
}

interface DayAggregate {
  stepsSum: number;
  activeEnergySum: number;
  rhrValues: number[];
  sleepMinutes: number;
  weightReadings: { time: string; lb: number }[];
}

function parseDailyMetrics(doc: Document, warnings: string[]): DailyMetrics[] {
  const byDate = new Map<string, DayAggregate>();
  const bucket = (date: string): DayAggregate => {
    let existing = byDate.get(date);
    if (!existing) {
      existing = { stepsSum: 0, activeEnergySum: 0, rhrValues: [], sleepMinutes: 0, weightReadings: [] };
      byDate.set(date, existing);
    }
    return existing;
  };

  const records = Array.from(doc.querySelectorAll("Record"));
  if (records.length === 0) {
    warnings.push("No <Record> elements found — this may not be a full Apple Health export.");
  }

  for (const record of records) {
    const type = record.getAttribute("type") ?? "";
    const startDateRaw = record.getAttribute("startDate");
    const endDateRaw = record.getAttribute("endDate");
    const value = record.getAttribute("value");
    if (!startDateRaw) continue;
    const date = toIsoDate(parseAppleDate(startDateRaw));

    switch (type) {
      case "HKQuantityTypeIdentifierStepCount":
        bucket(date).stepsSum += Number(value ?? 0);
        break;
      case "HKQuantityTypeIdentifierActiveEnergyBurned":
        bucket(date).activeEnergySum += Number(value ?? 0);
        break;
      case "HKQuantityTypeIdentifierRestingHeartRate":
        if (value) bucket(date).rhrValues.push(Number(value));
        break;
      case "HKCategoryTypeIdentifierSleepAnalysis": {
        if (endDateRaw) {
          const minutes = (parseAppleDate(endDateRaw).getTime() - parseAppleDate(startDateRaw).getTime()) / 60000;
          if (minutes > 0) bucket(date).sleepMinutes += minutes;
        }
        break;
      }
      case "HKQuantityTypeIdentifierBodyMass": {
        if (value) {
          const unit = record.getAttribute("unit");
          const raw = Number(value);
          const lb = unit === "kg" ? raw * KG_TO_LB : raw;
          bucket(date).weightReadings.push({ time: startDateRaw, lb });
        }
        break;
      }
      default:
        break;
    }
  }

  return Array.from(byDate.entries()).map(([date, agg]) => ({
    id: uuid(),
    date,
    weightLb: agg.weightReadings.sort((a, b) => a.time.localeCompare(b.time)).at(-1)?.lb ?? null,
    steps: agg.stepsSum || null,
    restingHeartRate: agg.rhrValues.length > 0 ? average(agg.rhrValues) : null,
    sleepDurationMinutes: agg.sleepMinutes || null,
    sleepQuality: null,
    activeEnergyKcal: agg.activeEnergySum || null,
    totalEnergyKcal: null,
    perceivedEnergy: null,
    hunger: null,
    soreness: null,
    stress: null,
    mood: null,
    notes: null,
  }));
}
