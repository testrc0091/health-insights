import { subDays } from "date-fns";
import { runAnalyzers, single, type DraftInsight } from "../../domain/insights/engine";
import { analyzeNutritionAdherence, type NutritionAdherenceRecord } from "../../domain/insights/analyzers/nutritionAdherence";
import { analyzeWeightVsCyclePhase, type CycleWeightRecord } from "../../domain/insights/analyzers/weightVsCyclePhase";
import {
  analyzeCaffeineVsSleep,
  analyzeSugarVsEnergy,
  type SugarCaffeineRecoveryRecord,
} from "../../domain/insights/analyzers/sugarCaffeineVsRecovery";
import { analyzeTrainingLoadVsSoreness, type TrainingLoadSorenessRecord } from "../../domain/insights/analyzers/trainingLoadVsSoreness";
import { analyzeAcneVsCyclePhase, type CycleAcneRecord } from "../../domain/insights/analyzers/acneVsCyclePhase";
import { aggregateWeeklyLoad } from "../../domain/training/load";
import { toIsoDate } from "../../domain/dateUtils";
import { dailyMetricsRepository, cycleRepository, getFoodEntriesInRange, getWorkoutsInRange, skinEntryRepository } from "../../storage/repositories";
import { getOrResolveNutritionTarget, sumParsedFoods } from "./nutritionService";
import { phaseNameForDateInCycles } from "./cycleService";
import type { FoodEntry } from "../../storage/schemas/nutrition";

const HISTORY_DAYS = 30;

function addDaysToIsoDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Runs every registered cross-domain analyzer against the last `HISTORY_DAYS` of
 * stored data. This is the app-composition wiring the domain-layer engine.ts
 * deliberately stays agnostic of — each analyzer gets its own narrow, purpose-built
 * record shape built here from raw repository data. */
export async function computeInsights(referenceDate: Date = new Date()): Promise<DraftInsight[]> {
  const endDate = toIsoDate(referenceDate);
  const startDate = toIsoDate(subDays(referenceDate, HISTORY_DAYS));

  const [dailyMetrics, skinEntries, cycles, foodEntries, workouts] = await Promise.all([
    dailyMetricsRepository.getAll(),
    skinEntryRepository.getAll(),
    cycleRepository.getAll(),
    getFoodEntriesInRange(startDate, endDate),
    getWorkoutsInRange(`${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`),
  ]);

  const metricsInRange = dailyMetrics.filter((d) => d.date >= startDate && d.date <= endDate);
  const metricsByDate = new Map(dailyMetrics.map((d) => [d.date, d]));

  const foodByDate = new Map<string, FoodEntry[]>();
  for (const entry of foodEntries) {
    const list = foodByDate.get(entry.date) ?? [];
    list.push(entry);
    foodByDate.set(entry.date, list);
  }

  const nutritionRecords: NutritionAdherenceRecord[] = [];
  const sugarCaffeineRecords: SugarCaffeineRecoveryRecord[] = [];
  for (const [date, entries] of foodByDate) {
    const totals = sumParsedFoods(entries);
    const target = await getOrResolveNutritionTarget(date);
    nutritionRecords.push(
      { date, label: "calories", targetAmount: target.calorieTarget, consumedAmount: totals.calories },
      { date, label: "protein", targetAmount: target.proteinTargetG, consumedAmount: totals.proteinG },
      { date, label: "fiber", targetAmount: target.fiberTargetG, consumedAmount: totals.fiberG },
    );

    const nextDate = addDaysToIsoDate(date, 1);
    const nextMetrics = metricsByDate.get(nextDate);
    sugarCaffeineRecords.push({
      date,
      caffeineMg: totals.caffeineMg,
      addedSugarG: totals.addedSugarG,
      nextDaySleepQuality: nextMetrics?.sleepQuality ?? null,
      nextDayEnergy: nextMetrics?.perceivedEnergy ?? null,
    });
  }

  const weightRecords: CycleWeightRecord[] = [];
  for (const d of metricsInRange) {
    if (d.weightLb == null) continue;
    const cycleIndex = cycles.findIndex((c) => d.date >= c.startDate && (c.endDate == null || d.date < c.endDate));
    const phase = phaseNameForDateInCycles(d.date, cycles);
    if (cycleIndex >= 0 && phase) weightRecords.push({ cycleIndex, phase, weightLb: d.weightLb });
  }

  const loadByDate = new Map<string, number>();
  for (const w of workouts) {
    const date = toIsoDate(new Date(w.startTime));
    const load = aggregateWeeklyLoad([{ workoutType: w.workoutType, durationMinutes: w.durationMinutes }]);
    const existing = loadByDate.get(date) ?? 0;
    loadByDate.set(date, existing + load.lowerBodyLoad + load.upperBodyLoad + load.highImpactLoad);
  }
  const trainingLoadRecords: TrainingLoadSorenessRecord[] = Array.from(loadByDate.entries()).map(
    ([date, trainingLoadScore]) => ({
      date,
      trainingLoadScore,
      nextDaySoreness: metricsByDate.get(addDaysToIsoDate(date, 1))?.soreness ?? null,
    }),
  );

  const acneRecords: CycleAcneRecord[] = [];
  for (const s of skinEntries) {
    const cycleIndex = cycles.findIndex((c) => s.date >= c.startDate && (c.endDate == null || s.date < c.endDate));
    const phase = phaseNameForDateInCycles(s.date, cycles);
    if (cycleIndex >= 0 && phase) acneRecords.push({ cycleIndex, phase, acneSeverity: s.acneSeverity });
  }

  return runAnalyzers([
    () => single(analyzeNutritionAdherence(nutritionRecords, "calories")),
    () => single(analyzeNutritionAdherence(nutritionRecords, "protein")),
    () => single(analyzeNutritionAdherence(nutritionRecords, "fiber")),
    () => single(analyzeWeightVsCyclePhase(weightRecords, "luteal")),
    () => single(analyzeAcneVsCyclePhase(acneRecords, "luteal")),
    () => single(analyzeCaffeineVsSleep(sugarCaffeineRecords)),
    () => single(analyzeSugarVsEnergy(sugarCaffeineRecords)),
    () => single(analyzeTrainingLoadVsSoreness(trainingLoadRecords)),
  ]);
}
