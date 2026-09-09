import { v4 as uuid } from "uuid";
import { endOfWeek, startOfWeek } from "date-fns";
import { toIsoDate } from "../../domain/dateUtils";
import { rollingAverage, trendSlopePerWeek } from "../../domain/weight/trend";
import { topInsights } from "../../domain/insights/engine";
import { computeInsights } from "./insightsService";
import { sumParsedFoods, getOrResolveNutritionTarget } from "./nutritionService";
import {
  getDailyMetricsInRange,
  getFoodEntriesInRange,
  getMenstrualEntriesInRange,
  getWorkoutsInRange,
  weeklyReportRepository,
} from "../../storage/repositories";
import type { FoodEntry } from "../../storage/schemas/nutrition";
import type { WeeklyReport } from "../../storage/schemas/derived";

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Generates the weekly report (nutrition, training, weight, recovery, cycle, skin
 * summaries + up to 3 top insights, brief's own limit — see domain/insights/engine.ts
 * topInsights). Week starts Monday, matching IMPLEMENTATION_PLAN.md's documented
 * assumption. Persists the result so past weeks stay viewable without recomputing.
 */
export async function generateWeeklyReport(referenceDate: Date = new Date()): Promise<WeeklyReport> {
  const weekStartIso = toIsoDate(startOfWeek(referenceDate, { weekStartsOn: 1 }));
  const weekEndIso = toIsoDate(endOfWeek(referenceDate, { weekStartsOn: 1 }));

  const [dailyMetrics, foodEntries, menstrualEntries, insights, workouts] = await Promise.all([
    getDailyMetricsInRange(weekStartIso, weekEndIso),
    getFoodEntriesInRange(weekStartIso, weekEndIso),
    getMenstrualEntriesInRange(weekStartIso, weekEndIso),
    computeInsights(referenceDate),
    getWorkoutsInRange(`${weekStartIso}T00:00:00.000Z`, `${weekEndIso}T23:59:59.999Z`),
  ]);

  const foodByDate = new Map<string, FoodEntry[]>();
  for (const entry of foodEntries) {
    const list = foodByDate.get(entry.date) ?? [];
    list.push(entry);
    foodByDate.set(entry.date, list);
  }
  const dailyTotals = await Promise.all(
    Array.from(foodByDate.entries()).map(async ([date, entries]) => ({
      totals: sumParsedFoods(entries),
      target: await getOrResolveNutritionTarget(date),
    })),
  );

  const avgCalories = average(dailyTotals.map((d) => d.totals.calories));
  const avgProteinG = average(dailyTotals.map((d) => d.totals.proteinG));
  const avgFiberG = average(dailyTotals.map((d) => d.totals.fiberG));
  const avgCarbsG = average(dailyTotals.map((d) => d.totals.carbsG));
  const targetAdherencePct = average(
    dailyTotals.map((d) => (d.target.calorieTarget > 0 ? (d.totals.calories / d.target.calorieTarget) * 100 : 0)),
  );

  const liftingSessions = workouts.filter((w) => w.workoutType === "strength").length;
  const volleyballMinutes = workouts
    .filter((w) => w.workoutType === "volleyball")
    .reduce((sum, w) => sum + w.durationMinutes, 0);
  const avgSteps = average(dailyMetrics.map((d) => d.steps ?? 0));

  const weights = dailyMetrics
    .filter((d) => d.weightLb != null)
    .map((d) => ({ date: d.date, weightLb: d.weightLb! }));
  const rolling = rollingAverage(weights);
  const sevenDayAvg = rolling.length > 0 ? rolling[rolling.length - 1]!.average : 0;

  const withRhr = dailyMetrics.filter((d) => d.restingHeartRate != null);
  const withSoreness = dailyMetrics.filter((d) => d.soreness != null);
  const withEnergy = dailyMetrics.filter((d) => d.perceivedEnergy != null);
  const periodStartedThisWeek = menstrualEntries.some((e) => e.periodStart);

  const report: WeeklyReport = {
    id: uuid(),
    weekStartDate: weekStartIso,
    nutritionSummary: { avgCalories, avgProteinG, avgFiberG, avgCarbsG, targetAdherencePct },
    trainingSummary: {
      liftingSessions,
      volleyballMinutes,
      avgSteps,
      trainingLoadScore: liftingSessions * 10 + volleyballMinutes * 0.5,
    },
    weightSummary: { sevenDayAvg, trendSlopePerWeek: trendSlopePerWeek(weights) },
    recoverySummary: {
      avgSleepMinutes: average(dailyMetrics.map((d) => d.sleepDurationMinutes ?? 0)),
      avgRestingHeartRate: withRhr.length > 0 ? average(withRhr.map((d) => d.restingHeartRate!)) : null,
      avgSoreness: withSoreness.length > 0 ? average(withSoreness.map((d) => d.soreness!)) : null,
      avgEnergy: withEnergy.length > 0 ? average(withEnergy.map((d) => d.perceivedEnergy!)) : null,
    },
    cycleSummary: {
      cycleDay: null,
      periodStatus: periodStartedThisWeek ? "Period started this week" : null,
      notablePatterns: [],
    },
    skinSummary: { acneTrend: "insufficient_data" },
    topRecommendations: topInsights(insights, 3).map((insight) => ({ ...insight, id: uuid() })),
    generatedAt: new Date().toISOString(),
  };

  await weeklyReportRepository.put(report);
  return report;
}
