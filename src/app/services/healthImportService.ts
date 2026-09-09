import { parseAppleHealthExport } from "../../integrations/health/appleHealthExportAdapter";
import { dailyMetricsRepository, workoutRepository } from "../../storage/repositories";

export interface HealthImportSummary {
  workoutsAdded: number;
  workoutsSkippedAsDuplicate: number;
  dailyMetricsMerged: number;
  warnings: string[];
}

/**
 * Imports an Apple Health "export.xml", deduping workouts by (source,
 * sourceWorkoutId) and merging DailyMetrics by date — so re-importing the same or an
 * overlapping export never creates duplicate rows (DATA_MODEL.md's stated dedup
 * rule). Each parsed workout gets a fresh UUID, so without this dedup step a second
 * import of the same file would double every workout.
 */
export async function importAppleHealthExport(xmlText: string): Promise<HealthImportSummary> {
  const { workouts, dailyMetrics, warnings } = parseAppleHealthExport(xmlText);

  const existingWorkouts = await workoutRepository.getAll();
  const existingKeys = new Set(
    existingWorkouts
      .filter((w) => w.source === "apple_health" && w.sourceWorkoutId)
      .map((w) => w.sourceWorkoutId as string),
  );
  const newWorkouts = workouts.filter((w) => !w.sourceWorkoutId || !existingKeys.has(w.sourceWorkoutId));
  if (newWorkouts.length > 0) await workoutRepository.bulkPut(newWorkouts);

  const existingMetrics = await dailyMetricsRepository.getAll();
  const metricsByDate = new Map(existingMetrics.map((m) => [m.date, m]));
  let merged = 0;
  for (const incoming of dailyMetrics) {
    const existing = metricsByDate.get(incoming.date);
    if (existing) {
      merged++;
      await dailyMetricsRepository.put({
        ...existing,
        weightLb: incoming.weightLb ?? existing.weightLb,
        steps: incoming.steps ?? existing.steps,
        restingHeartRate: incoming.restingHeartRate ?? existing.restingHeartRate,
        sleepDurationMinutes: incoming.sleepDurationMinutes ?? existing.sleepDurationMinutes,
        activeEnergyKcal: incoming.activeEnergyKcal ?? existing.activeEnergyKcal,
      });
    } else {
      await dailyMetricsRepository.put(incoming);
    }
  }

  return {
    workoutsAdded: newWorkouts.length,
    workoutsSkippedAsDuplicate: workouts.length - newWorkouts.length,
    dailyMetricsMerged: merged,
    warnings,
  };
}
