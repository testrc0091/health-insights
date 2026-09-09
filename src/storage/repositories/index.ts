import { db } from "../db";
import { createRepository } from "./createRepository";
import { userProfileSchema, DEFAULT_USER_PROFILE, type UserProfile } from "../schemas/userProfile";
import { dailyMetricsSchema } from "../schemas/dailyMetrics";
import { workoutSchema, strengthWorkoutSchema, volleyballSessionSchema } from "../schemas/workout";
import { nutritionDaySchema, foodEntrySchema } from "../schemas/nutrition";
import { bodyMeasurementSchema } from "../schemas/bodyMeasurement";
import { symptomEntrySchema, runSessionSchema } from "../schemas/symptomAndRun";
import { skinEntrySchema, skincareChangeSchema } from "../schemas/skin";
import { menstrualCycleEntrySchema, cycleSchema } from "../schemas/cycle";
import { insightSchema, weeklyReportSchema } from "../schemas/derived";
import { photoBlobSchema } from "../schemas/photoBlob";

export const userProfileRepository = createRepository(db.userProfile, userProfileSchema);
export const dailyMetricsRepository = createRepository(db.dailyMetrics, dailyMetricsSchema);
export const workoutRepository = createRepository(db.workouts, workoutSchema);
export const strengthWorkoutRepository = createRepository(db.strengthWorkouts, strengthWorkoutSchema);
export const volleyballSessionRepository = createRepository(db.volleyballSessions, volleyballSessionSchema);
export const nutritionDayRepository = createRepository(db.nutritionDays, nutritionDaySchema);
export const foodEntryRepository = createRepository(db.foodEntries, foodEntrySchema);
export const bodyMeasurementRepository = createRepository(db.bodyMeasurements, bodyMeasurementSchema);
export const symptomEntryRepository = createRepository(db.symptomEntries, symptomEntrySchema);
export const runSessionRepository = createRepository(db.runSessions, runSessionSchema);
export const skinEntryRepository = createRepository(db.skinEntries, skinEntrySchema);
export const skincareChangeRepository = createRepository(db.skincareChanges, skincareChangeSchema);
export const menstrualCycleEntryRepository = createRepository(db.menstrualCycleEntries, menstrualCycleEntrySchema);
export const cycleRepository = createRepository(db.cycles, cycleSchema);
export const insightRepository = createRepository(db.insights, insightSchema);
export const weeklyReportRepository = createRepository(db.weeklyReports, weeklyReportSchema);
export const photoBlobRepository = createRepository(db.photoBlobs, photoBlobSchema);

/** Almost every screen needs "the current profile, or sensible defaults if onboarding
 * hasn't run yet" rather than an undefined check at every call site. */
export async function getUserProfileOrDefault(): Promise<UserProfile> {
  const existing = await userProfileRepository.getById("default");
  return existing ?? DEFAULT_USER_PROFILE;
}

export async function getDailyMetricsInRange(startDate: string, endDate: string) {
  return db.dailyMetrics.where("date").between(startDate, endDate, true, true).toArray();
}

export async function getFoodEntriesForDate(date: string) {
  return db.foodEntries.where("date").equals(date).toArray();
}

export async function getFoodEntriesInRange(startDate: string, endDate: string) {
  return db.foodEntries.where("date").between(startDate, endDate, true, true).toArray();
}

export async function getBodyMeasurementsByType(measurementType: string) {
  return db.bodyMeasurements.where("measurementType").equals(measurementType).sortBy("date");
}

export async function getMenstrualEntriesInRange(startDate: string, endDate: string) {
  return db.menstrualCycleEntries.where("date").between(startDate, endDate, true, true).toArray();
}

export async function getMostRecentCycle() {
  return db.cycles.orderBy("startDate").last();
}

export async function getWorkoutsInRange(startTime: string, endTime: string) {
  return db.workouts.where("startTime").between(startTime, endTime, true, true).toArray();
}
