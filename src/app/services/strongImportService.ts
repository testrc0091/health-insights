import { parseStrongCsv } from "../../integrations/workouts/strongCsvAdapter";
import { strengthWorkoutRepository, workoutRepository } from "../../storage/repositories";

export interface StrongImportSummary {
  workoutsAdded: number;
  workoutsSkippedAsDuplicate: number;
  warnings: string[];
}

/** Imports a Strong CSV export, deduping by (source, sourceWorkoutId) the same way as
 * the Apple Health import — a fresh UUID is generated per parse, so re-importing an
 * overlapping export must not double every session. */
export async function importStrongCsv(csvText: string): Promise<StrongImportSummary> {
  const { workouts, strengthWorkouts, warnings } = parseStrongCsv(csvText);

  const existingWorkouts = await workoutRepository.getAll();
  const existingKeys = new Set(
    existingWorkouts
      .filter((w) => w.source === "strong" && w.sourceWorkoutId)
      .map((w) => w.sourceWorkoutId as string),
  );

  const newIndexes = workouts
    .map((w, i) => (w.sourceWorkoutId && existingKeys.has(w.sourceWorkoutId) ? -1 : i))
    .filter((i) => i >= 0);
  const newWorkouts = newIndexes.map((i) => workouts[i]!);
  const newStrengthWorkouts = newIndexes.map((i) => strengthWorkouts[i]!);

  if (newWorkouts.length > 0) {
    await workoutRepository.bulkPut(newWorkouts);
    await strengthWorkoutRepository.bulkPut(newStrengthWorkouts);
  }

  return {
    workoutsAdded: newWorkouts.length,
    workoutsSkippedAsDuplicate: workouts.length - newWorkouts.length,
    warnings,
  };
}
