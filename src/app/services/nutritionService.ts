import {
  getFoodEntriesForDate,
  getFoodEntriesInRange,
  getUserProfileOrDefault,
  nutritionDayRepository,
} from "../../storage/repositories";
import {
  DEFAULT_ACTIVITY_CALORIE_TARGETS,
  resolveDayCalorieTarget,
} from "../../domain/nutrition/activityAdjustedTarget";
import type { DayOfWeek, ISODate } from "../../domain/models/common";
import type { FoodEntry } from "../../storage/schemas/nutrition";
import type { NutritionDay } from "../../storage/schemas/nutrition";
import type { DailyIntakeTotal } from "../../domain/nutrition/sugarCaffeineBaseline";

export interface DailyNutritionTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  addedSugarG: number;
  totalSugarG: number;
  caffeineMg: number;
}

const EMPTY_TOTALS: DailyNutritionTotals = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  addedSugarG: 0,
  totalSugarG: 0,
  caffeineMg: 0,
};

export function sumParsedFoods(entries: FoodEntry[]): DailyNutritionTotals {
  const totals = { ...EMPTY_TOTALS };
  for (const entry of entries) {
    for (const food of entry.parsedFoods) {
      totals.calories += food.calories;
      totals.proteinG += food.proteinG;
      totals.carbsG += food.carbsG ?? 0;
      totals.fatG += food.fatG ?? 0;
      totals.fiberG += food.fiberG;
      totals.addedSugarG += food.addedSugarG ?? 0;
      totals.totalSugarG += food.totalSugarG ?? 0;
      totals.caffeineMg += food.caffeineMg ?? 0;
    }
  }
  return totals;
}

export async function getDailyNutritionTotals(date: ISODate): Promise<DailyNutritionTotals> {
  return sumParsedFoods(await getFoodEntriesForDate(date));
}

/** Per-day sugar/caffeine totals for a date range — shaped for
 * domain/nutrition/sugarCaffeineBaseline.ts's `flagUnusualIntakeDays`. */
export async function getDailyIntakeTotalsInRange(
  startDate: ISODate,
  endDate: ISODate,
): Promise<DailyIntakeTotal[]> {
  const entries = await getFoodEntriesInRange(startDate, endDate);
  const byDate = new Map<ISODate, FoodEntry[]>();
  for (const entry of entries) {
    const forDate = byDate.get(entry.date) ?? [];
    forDate.push(entry);
    byDate.set(entry.date, forDate);
  }
  return Array.from(byDate.entries()).map(([date, dayEntries]) => {
    const totals = sumParsedFoods(dayEntries);
    return { date, addedSugarG: totals.addedSugarG, totalSugarG: totals.totalSugarG, caffeineMg: totals.caffeineMg };
  });
}

const DAY_INDEX_TO_DOW: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Resolves the day's nutrition target: a persisted `NutritionDay` row always wins
 * (e.g. after calibration); otherwise it's derived on the fly from the user's
 * `trainingSchedule` for that weekday (activityAdjustedTarget.ts's resolution rule),
 * so every day has a sensible target even before any explicit row exists for it.
 */
export async function getOrResolveNutritionTarget(date: ISODate): Promise<NutritionDay> {
  const all = await nutritionDayRepository.getAll();
  const found = all.find((n) => n.date === date);
  if (found) return found;

  const profile = await getUserProfileOrDefault();
  const dow = DAY_INDEX_TO_DOW[new Date(`${date}T00:00:00`).getDay()]!;
  const plan = profile.trainingSchedule.find((p) => p.day === dow);
  const calorieTarget = plan
    ? resolveDayCalorieTarget(plan, DEFAULT_ACTIVITY_CALORIE_TARGETS)
    : DEFAULT_ACTIVITY_CALORIE_TARGETS.other;

  return {
    id: `resolved-${date}`,
    date,
    calorieTarget,
    proteinTargetG: profile.proteinGoalG,
    fiberTargetG: profile.fiberGoalG,
    carbTargetG: null,
    fatTargetG: null,
    targetSource: "estimated",
  };
}
