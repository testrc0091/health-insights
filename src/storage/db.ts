import Dexie, { type Table } from "dexie";
import type { UserProfile } from "./schemas/userProfile";
import type { DailyMetrics } from "./schemas/dailyMetrics";
import type { StrengthWorkout, VolleyballSession, Workout } from "./schemas/workout";
import type { FoodEntry, NutritionDay } from "./schemas/nutrition";
import type { BodyMeasurement } from "./schemas/bodyMeasurement";
import type { RunSession, SymptomEntry } from "./schemas/symptomAndRun";
import type { SkinEntry, SkincareChange } from "./schemas/skin";
import type { Cycle, MenstrualCycleEntry } from "./schemas/cycle";
import type { InsightRecord, WeeklyReport } from "./schemas/derived";
import type { PhotoBlob } from "./schemas/photoBlob";

/**
 * One Dexie database for the whole app (ARCHITECTURE.md §8.1: Dexie/IndexedDB, not
 * SQLite-via-WASM). The `.stores()` schema strings list only the INDEXED fields —
 * every other property on a stored object is preserved automatically by Dexie, it
 * just isn't queryable by that field without adding it here later (a safe, additive
 * migration via `this.version(n + 1)`, never touching existing data).
 *
 * `strengthWorkouts`/`volleyballSessions` are keyed by `workoutId` (their 1:1 join back
 * to `workouts`), not their own `id`, matching DATA_MODEL.md's "extends Workout 1:1"
 * relationship.
 */
export class HealthInsightsDb extends Dexie {
  userProfile!: Table<UserProfile, string>;
  dailyMetrics!: Table<DailyMetrics, string>;
  workouts!: Table<Workout, string>;
  strengthWorkouts!: Table<StrengthWorkout, string>;
  volleyballSessions!: Table<VolleyballSession, string>;
  nutritionDays!: Table<NutritionDay, string>;
  foodEntries!: Table<FoodEntry, string>;
  bodyMeasurements!: Table<BodyMeasurement, string>;
  symptomEntries!: Table<SymptomEntry, string>;
  runSessions!: Table<RunSession, string>;
  skinEntries!: Table<SkinEntry, string>;
  skincareChanges!: Table<SkincareChange, string>;
  menstrualCycleEntries!: Table<MenstrualCycleEntry, string>;
  cycles!: Table<Cycle, string>;
  insights!: Table<InsightRecord, string>;
  weeklyReports!: Table<WeeklyReport, string>;
  photoBlobs!: Table<PhotoBlob, string>;

  constructor() {
    super("health-insights");
    this.version(1).stores({
      userProfile: "id",
      dailyMetrics: "id, date",
      workouts: "id, workoutType, startTime, source, sourceWorkoutId",
      strengthWorkouts: "workoutId",
      volleyballSessions: "workoutId",
      nutritionDays: "id, date",
      foodEntries: "id, date, timestamp",
      bodyMeasurements: "id, date, measurementType",
      symptomEntries: "id, dateTime",
      runSessions: "id, workoutId",
      skinEntries: "id, date",
      skincareChanges: "id, date",
      menstrualCycleEntries: "id, date",
      cycles: "id, startDate",
      insights: "id, domain, generatedAt",
      weeklyReports: "id, weekStartDate",
      photoBlobs: "id",
    });
  }
}

export const db = new HealthInsightsDb();
