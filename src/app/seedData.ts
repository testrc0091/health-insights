import { v4 as uuid } from "uuid";
import { addDays, subDays } from "date-fns";
import { toIsoDate } from "../domain/dateUtils";
import { DEFAULT_ACTIVITY_CALORIE_TARGETS, resolveDayCalorieTarget } from "../domain/nutrition/activityAdjustedTarget";
import { estimateVolleyballCalories } from "../domain/training/volleyballModel";
import { estimateCycleWindow, phaseForDate } from "../domain/cycle/phaseEstimation";
import { parseNutritionText } from "../integrations/nutrition/nutritionParser";
import {
  bodyMeasurementRepository,
  dailyMetricsRepository,
  foodEntryRepository,
  menstrualCycleEntryRepository,
  nutritionDayRepository,
  skinEntryRepository,
  strengthWorkoutRepository,
  userProfileRepository,
  volleyballSessionRepository,
  workoutRepository,
} from "../storage/repositories";
import { DEFAULT_USER_PROFILE } from "../storage/schemas/userProfile";
import type { ActivityType, DayOfWeek } from "../domain/models/common";
import { recomputeCycles } from "./services/cycleService";

const SEED_DAYS = 21;
const SAMPLE_MEALS = [
  "2 eggs and toast with coffee",
  "chicken breast and rice with broccoli",
  "greek yogurt and a banana",
  "protein shake and almonds",
  "salmon and sweet potato with avocado",
  "oatmeal and peanut butter",
  "a donut and coffee",
];
const DAY_INDEX_TO_DOW: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Populates ~3 weeks of demo data across every domain so Today/Nutrition/Training/
 * Cycle/Trends aren't empty on first load (IMPLEMENTATION_PLAN.md Phase 1 item 4).
 * Guarded by "does any DailyMetrics row already exist" — never overwrites real user
 * data, including data restored from a JSON import.
 */
export async function seedDemoDataIfEmpty(): Promise<void> {
  const existing = await dailyMetricsRepository.getAll();
  if (existing.length > 0) return;

  await userProfileRepository.put(DEFAULT_USER_PROFILE);

  const today = new Date();
  const scheduleByDow = new Map(DEFAULT_USER_PROFILE.trainingSchedule.map((p) => [p.day, p.activityType]));

  // ~1.5 cycles of history so cycle-phase-dependent seed data (weight, acne) and the
  // Cycle screen itself have something real to show.
  const cycleStartDates = [subDays(today, 45), subDays(today, 17)];
  for (const start of cycleStartDates) {
    for (let i = 0; i < 5; i++) {
      const date = toIsoDate(addDays(start, i));
      await menstrualCycleEntryRepository.put({
        id: uuid(),
        date,
        bleeding: i === 0 ? "heavy" : i < 3 ? "medium" : "light",
        periodStart: i === 0,
        periodEnd: i === 4,
        cramps: i < 2 ? 5 : 2,
        breastTenderness: null,
        bloating: i < 2 ? 4 : 1,
        headache: null,
        fatigue: i < 2 ? 3 : null,
        mood: null,
        irritability: null,
        cravings: null,
        hunger: null,
        sleepDisruption: null,
        giSymptoms: null,
        acneFlare: i < 2,
        libido: null,
        cervicalMucus: null,
        ovulationTestResult: null,
        basalBodyTempF: null,
        notes: null,
      });
    }
  }
  const cycles = await recomputeCycles();

  const mostRecentCycleStart = cycleStartDates[cycleStartDates.length - 1]!;
  const cycleWindow = estimateCycleWindow({
    periodStartDate: toIsoDate(mostRecentCycleStart),
    periodLengthDays: 5,
    averageCycleLengthDays: 28,
    averageLutealLengthDays: 14,
  });

  let baselineWeight = 148;
  let mealIndex = 0;
  let priorVolleyballSessions = 0;

  for (let offset = SEED_DAYS - 1; offset >= 0; offset--) {
    const date = subDays(today, offset);
    const isoDate = toIsoDate(date);
    const dow = DAY_INDEX_TO_DOW[date.getDay()]!;
    const activityType: ActivityType = scheduleByDow.get(dow) ?? "other";

    const noise = Math.sin(offset * 1.7) * 0.4;
    baselineWeight -= 0.03;
    const weightLb = Math.round((baselineWeight + noise) * 10) / 10;
    const phase =
      cycles.length > 0 ? phaseForDate(isoDate, toIsoDate(mostRecentCycleStart), 5, cycleWindow) : "follicular";

    await dailyMetricsRepository.put({
      id: uuid(),
      date: isoDate,
      weightLb,
      steps: 6000 + Math.round(Math.random() * 4000),
      restingHeartRate: 58 + Math.round(Math.random() * 6),
      sleepDurationMinutes: 400 + Math.round(Math.random() * 90),
      sleepQuality: (3 + Math.round(Math.random() * 2)) as 1 | 2 | 3 | 4 | 5,
      activeEnergyKcal: activityType === "rest" ? 250 : 450,
      totalEnergyKcal: null,
      perceivedEnergy: (3 + Math.round(Math.random() * 2)) as 1 | 2 | 3 | 4 | 5,
      hunger: (2 + Math.round(Math.random() * 3)) as 1 | 2 | 3 | 4 | 5,
      soreness: activityType === "lifting" ? ((2 + Math.round(Math.random() * 3)) as 1 | 2 | 3 | 4 | 5) : null,
      stress: null,
      mood: null,
      notes: null,
    });

    const calorieTarget = resolveDayCalorieTarget({ activityType, calorieTarget: null }, DEFAULT_ACTIVITY_CALORIE_TARGETS);
    await nutritionDayRepository.put({
      id: uuid(),
      date: isoDate,
      calorieTarget,
      proteinTargetG: DEFAULT_USER_PROFILE.proteinGoalG,
      fiberTargetG: DEFAULT_USER_PROFILE.fiberGoalG,
      carbTargetG: null,
      fatTargetG: null,
      targetSource: "estimated",
    });

    const mealsToday = offset % 3 === 0 ? 3 : 2;
    for (let m = 0; m < mealsToday; m++) {
      const text = SAMPLE_MEALS[mealIndex % SAMPLE_MEALS.length]!;
      mealIndex++;
      await foodEntryRepository.put({
        id: uuid(),
        timestamp: date.toISOString(),
        date: isoDate,
        rawText: text,
        parsedFoods: parseNutritionText(text),
        source: "manual",
        notes: null,
      });
    }

    if (activityType === "lifting") {
      const workoutId = uuid();
      await workoutRepository.put({
        id: workoutId,
        source: "manual",
        sourceWorkoutId: null,
        workoutType: "strength",
        startTime: date.toISOString(),
        endTime: null,
        durationMinutes: 60,
        activeCaloriesKcal: 280,
        totalCaloriesKcal: null,
        averageHeartRate: null,
        maxHeartRate: null,
        hrZones: null,
        perceivedExertion: 7,
        notes: null,
      });
      await strengthWorkoutRepository.put({
        workoutId,
        exercises: [
          {
            id: uuid(),
            name: "Barbell Back Squat",
            orderIndex: 0,
            sets: [0, 1, 2].map((i) => ({
              id: uuid(),
              orderIndex: i,
              weightLb: 135 + i * 10,
              reps: 8 - i,
              rir: 2,
              rpe: 7 + i * 0.5,
              restSeconds: 120,
              isPr: false,
            })),
          },
          {
            id: uuid(),
            name: "Bench Press",
            orderIndex: 1,
            sets: [0, 1, 2].map((i) => ({
              id: uuid(),
              orderIndex: i,
              weightLb: 95 + i * 5,
              reps: 10 - i,
              rir: 2,
              rpe: 7,
              restSeconds: 90,
              isPr: false,
            })),
          },
        ],
      });
    }

    if (activityType === "volleyball") {
      const workoutId = uuid();
      const durationMinutes = 120;
      const estimate = estimateVolleyballCalories({
        durationMinutes,
        averageHeartRate: 145,
        restingHeartRate: 60,
        observedMaxHeartRate: 190,
        priorSessionsCount: priorVolleyballSessions,
      });
      priorVolleyballSessions++;

      await workoutRepository.put({
        id: workoutId,
        source: "manual",
        sourceWorkoutId: null,
        workoutType: "volleyball",
        startTime: date.toISOString(),
        endTime: null,
        durationMinutes,
        activeCaloriesKcal: Math.round(estimate.estimateKcal),
        totalCaloriesKcal: null,
        averageHeartRate: 145,
        maxHeartRate: 178,
        hrZones: null,
        perceivedExertion: 8,
        notes: null,
      });
      await volleyballSessionRepository.put({
        workoutId,
        format: "6v6",
        activePlayMinutes: 90,
        passiveRestMinutes: 30,
        warmupActivity: "dynamic stretching",
        jumpVolume: "high",
        role: "outside hitter",
        appleActiveCaloriesKcal: Math.round(estimate.estimateKcal * 0.9),
        modelEstimate: {
          name: "volleyballActiveCalories",
          value: estimate.estimateKcal,
          rangeLow: estimate.rangeLowKcal,
          rangeHigh: estimate.rangeHighKcal,
          confidence: estimate.confidence,
          sources: ["heartRate", "duration"],
          algorithmVersion: "volleyball-model.v1",
          computedAt: new Date().toISOString(),
        },
        notes: null,
      });
    }

    if (offset % 7 === 0) {
      await bodyMeasurementRepository.put({
        id: uuid(),
        date: isoDate,
        measurementType: "waist",
        customLabel: null,
        side: "n/a",
        valueCm: 71 + Math.round(Math.random() * 2),
        photoBlobId: null,
        notes: null,
      });
    }

    await skinEntryRepository.put({
      id: uuid(),
      date: isoDate,
      acneSeverity: (phase === "luteal" ? 2 : 1) as 0 | 1 | 2 | 3 | 4,
      breakoutAreas: phase === "luteal" ? ["chin"] : [],
      lesionType: null,
      dryness: null,
      irritation: null,
      photoBlobId: null,
      skincareProductsUsed: [],
      notes: null,
    });
  }
}
