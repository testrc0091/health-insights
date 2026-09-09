import { getWorkoutsInRange, strengthWorkoutRepository } from "../../storage/repositories";
import { aggregateWeeklyLoad, type SessionLoadInput, type WeeklyTrainingLoad } from "../../domain/training/load";
import type { StrengthWorkout, Workout } from "../../storage/schemas/workout";

const LOWER_BODY_KEYWORDS = ["squat", "deadlift", "lunge", "leg", "calf", "hip thrust", "glute"];

function classifySetsByBody(strengthWorkout: StrengthWorkout | undefined): {
  upperBodySets: number;
  lowerBodySets: number;
} {
  if (!strengthWorkout) return { upperBodySets: 0, lowerBodySets: 0 };
  let upperBodySets = 0;
  let lowerBodySets = 0;
  for (const exercise of strengthWorkout.exercises) {
    const isLower = LOWER_BODY_KEYWORDS.some((k) => exercise.name.toLowerCase().includes(k));
    if (isLower) lowerBodySets += exercise.sets.length;
    else upperBodySets += exercise.sets.length;
  }
  return { upperBodySets, lowerBodySets };
}

/** Aggregates weekly training load across strength + volleyball + run sessions in a
 * datetime range, using domain/training/load.ts's aggregation rules. Strength sets are
 * classified upper/lower by a simple exercise-name keyword match — a real, if simple,
 * heuristic, not a full exercise taxonomy. */
export async function getWeeklyTrainingLoad(
  startTimeIso: string,
  endTimeIso: string,
): Promise<WeeklyTrainingLoad> {
  const workouts = await getWorkoutsInRange(startTimeIso, endTimeIso);
  const inputs: SessionLoadInput[] = [];

  for (const w of workouts) {
    if (w.workoutType === "strength") {
      const strengthWorkout = await strengthWorkoutRepository.getById(w.id);
      const { upperBodySets, lowerBodySets } = classifySetsByBody(strengthWorkout);
      inputs.push({ workoutType: "strength", durationMinutes: w.durationMinutes, upperBodySets, lowerBodySets });
    } else {
      inputs.push({ workoutType: w.workoutType, durationMinutes: w.durationMinutes });
    }
  }

  return aggregateWeeklyLoad(inputs);
}

export interface PrCandidate {
  exerciseName: string;
  date: string;
  weightLb: number;
  reps: number;
  isNewPr: boolean;
}

/** Scans strength history chronologically and flags each set that logged a new best
 * weight for its (exercise, rep count) pair — a simple, transparent PR definition
 * (heaviest weight ever logged for >= that many reps), not a 1RM-estimation formula. */
export async function detectPrs(workouts: Workout[]): Promise<PrCandidate[]> {
  const sorted = [...workouts]
    .filter((w) => w.workoutType === "strength")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const bestWeightForKey = new Map<string, number>();
  const results: PrCandidate[] = [];

  for (const workout of sorted) {
    const strengthWorkout = await strengthWorkoutRepository.getById(workout.id);
    if (!strengthWorkout) continue;
    for (const exercise of strengthWorkout.exercises) {
      for (const set of exercise.sets) {
        if (set.weightLb == null || set.reps == null) continue;
        const key = `${exercise.name}|${set.reps}`;
        const priorBest = bestWeightForKey.get(key) ?? 0;
        const isNewPr = set.weightLb > priorBest;
        if (isNewPr) bestWeightForKey.set(key, set.weightLb);
        results.push({
          exerciseName: exercise.name,
          date: workout.startTime,
          weightLb: set.weightLb,
          reps: set.reps,
          isNewPr,
        });
      }
    }
  }

  return results;
}
