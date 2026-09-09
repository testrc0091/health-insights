import {
  bodyMeasurementRepository,
  dailyMetricsRepository,
  foodEntryRepository,
  insightRepository,
  menstrualCycleEntryRepository,
  nutritionDayRepository,
  runSessionRepository,
  skinEntryRepository,
  skincareChangeRepository,
  strengthWorkoutRepository,
  symptomEntryRepository,
  userProfileRepository,
  volleyballSessionRepository,
  weeklyReportRepository,
  workoutRepository,
} from "../../storage/repositories";

const SCHEMA_VERSION = 1;

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  userProfile: unknown[];
  dailyMetrics: unknown[];
  workouts: unknown[];
  strengthWorkouts: unknown[];
  volleyballSessions: unknown[];
  nutritionDays: unknown[];
  foodEntries: unknown[];
  bodyMeasurements: unknown[];
  symptomEntries: unknown[];
  runSessions: unknown[];
  skinEntries: unknown[];
  skincareChanges: unknown[];
  menstrualCycleEntries: unknown[];
  insights: unknown[];
  weeklyReports: unknown[];
}

/**
 * Full-fidelity JSON backup of every RAW table (ARCHITECTURE.md/DATA_MODEL.md
 * "Import/export"). The derived `cycles` table is deliberately excluded — it's always
 * safe to recompute from raw MenstrualCycleEntry rows via
 * app/services/cycleService.ts's `recomputeCycles()` after a restore, never a second
 * source of truth. Photo blobs are also excluded from this MVP export (documented
 * limitation, keeps export size manageable) — a restored backup shows entries without
 * their photos; only the `photoBlobId` reference comes along.
 */
export async function exportBackup(): Promise<BackupPayload> {
  const [
    userProfile,
    dailyMetrics,
    workouts,
    strengthWorkouts,
    volleyballSessions,
    nutritionDays,
    foodEntries,
    bodyMeasurements,
    symptomEntries,
    runSessions,
    skinEntries,
    skincareChanges,
    menstrualCycleEntries,
    insights,
    weeklyReports,
  ] = await Promise.all([
    userProfileRepository.getAll(),
    dailyMetricsRepository.getAll(),
    workoutRepository.getAll(),
    strengthWorkoutRepository.getAll(),
    volleyballSessionRepository.getAll(),
    nutritionDayRepository.getAll(),
    foodEntryRepository.getAll(),
    bodyMeasurementRepository.getAll(),
    symptomEntryRepository.getAll(),
    runSessionRepository.getAll(),
    skinEntryRepository.getAll(),
    skincareChangeRepository.getAll(),
    menstrualCycleEntryRepository.getAll(),
    insightRepository.getAll(),
    weeklyReportRepository.getAll(),
  ]);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    userProfile,
    dailyMetrics,
    workouts,
    strengthWorkouts,
    volleyballSessions,
    nutritionDays,
    foodEntries,
    bodyMeasurements,
    symptomEntries,
    runSessions,
    skinEntries,
    skincareChanges,
    menstrualCycleEntries,
    insights,
    weeklyReports,
  };
}

async function bulkPutIfAny<T>(repo: { bulkPut: (items: T[]) => Promise<void> }, items: T[]): Promise<void> {
  if (items.length > 0) await repo.bulkPut(items);
}

/** Restores a JSON backup — every row goes back through its entity's Zod schema via
 * the repository's bulkPut (ARCHITECTURE.md §7: "an import is not a trusted
 * bulk-insert"). Existing rows sharing an id are overwritten; this is a merge/
 * restore, not a destructive replace of unrelated data. */
export async function importBackup(payload: BackupPayload): Promise<void> {
  await Promise.all([
    bulkPutIfAny(userProfileRepository, payload.userProfile as never[]),
    bulkPutIfAny(dailyMetricsRepository, payload.dailyMetrics as never[]),
    bulkPutIfAny(workoutRepository, payload.workouts as never[]),
    bulkPutIfAny(strengthWorkoutRepository, payload.strengthWorkouts as never[]),
    bulkPutIfAny(volleyballSessionRepository, payload.volleyballSessions as never[]),
    bulkPutIfAny(nutritionDayRepository, payload.nutritionDays as never[]),
    bulkPutIfAny(foodEntryRepository, payload.foodEntries as never[]),
    bulkPutIfAny(bodyMeasurementRepository, payload.bodyMeasurements as never[]),
    bulkPutIfAny(symptomEntryRepository, payload.symptomEntries as never[]),
    bulkPutIfAny(runSessionRepository, payload.runSessions as never[]),
    bulkPutIfAny(skinEntryRepository, payload.skinEntries as never[]),
    bulkPutIfAny(skincareChangeRepository, payload.skincareChanges as never[]),
    bulkPutIfAny(menstrualCycleEntryRepository, payload.menstrualCycleEntries as never[]),
    bulkPutIfAny(insightRepository, payload.insights as never[]),
    bulkPutIfAny(weeklyReportRepository, payload.weeklyReports as never[]),
  ]);
}
