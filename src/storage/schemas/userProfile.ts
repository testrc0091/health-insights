import { z } from "zod";
import { dayOfWeekPlanSchema } from "./common";

export const userProfileSchema = z.object({
  id: z.literal("default"),
  dateOfBirth: z.string().nullable(),
  sex: z.enum(["female", "male", "intersex", "prefer_not_to_say"]),
  heightCm: z.number().nullable(),
  currentWeightLb: z.number(),
  restingHeartRate: z.number().nullable(),
  observedMaxHeartRate: z.number().nullable(),
  preferredUnits: z.enum(["imperial", "metric"]),
  calorieGoal: z.number(),
  proteinGoalG: z.number(),
  fiberGoalG: z.number(),
  weightGoal: z.enum(["gain_muscle", "lose_fat", "maintain", "performance"]),
  trainingSchedule: z.array(dayOfWeekPlanSchema),
  addExerciseCaloriesToBudget: z.boolean(),
  contraception: z.object({ hormonal: z.boolean(), type: z.string().nullable() }),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: "default",
  dateOfBirth: null,
  sex: "prefer_not_to_say",
  heightCm: null,
  currentWeightLb: 150,
  restingHeartRate: null,
  observedMaxHeartRate: null,
  preferredUnits: "imperial",
  calorieGoal: 2500,
  proteinGoalG: 120,
  fiberGoalG: 30,
  weightGoal: "maintain",
  trainingSchedule: [
    { day: "mon", activityType: "lifting", calorieTarget: null },
    { day: "tue", activityType: "recovery", calorieTarget: null },
    { day: "wed", activityType: "lifting", calorieTarget: null },
    { day: "thu", activityType: "volleyball", calorieTarget: null },
    { day: "fri", activityType: "lifting", calorieTarget: null },
    { day: "sat", activityType: "volleyball", calorieTarget: null },
    { day: "sun", activityType: "rest", calorieTarget: null },
  ],
  addExerciseCaloriesToBudget: false,
  contraception: { hormonal: false, type: null },
};
