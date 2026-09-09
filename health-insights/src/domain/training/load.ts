export interface SessionLoadInput {
  workoutType: "strength" | "volleyball" | "run" | "other";
  durationMinutes: number;
  /** Only meaningful for strength sessions. */
  upperBodySets?: number;
  lowerBodySets?: number;
}

export interface WeeklyTrainingLoad {
  upperBodyLoad: number;
  lowerBodyLoad: number;
  highImpactLoad: number;
}

/**
 * Simple per-minute load heuristic for volleyball, since it has no set/rep structure
 * to count — chosen so volleyball still contributes real lower-body and high-impact
 * (jump) load even on weeks with zero Strong data (brief's explicit requirement:
 * "Volleyball should count heavily toward lower-body/high-impact workload even if
 * Strong does not log it"). These are deliberately simple placeholder weights, not a
 * validated biomechanical load model — documented as an assumption, refinable later
 * without changing the aggregation shape.
 */
const VOLLEYBALL_LOWER_BODY_LOAD_PER_MINUTE = 1;
const VOLLEYBALL_HIGH_IMPACT_LOAD_PER_MINUTE = 1.5;

export function aggregateWeeklyLoad(sessions: SessionLoadInput[]): WeeklyTrainingLoad {
  const load: WeeklyTrainingLoad = { upperBodyLoad: 0, lowerBodyLoad: 0, highImpactLoad: 0 };

  for (const session of sessions) {
    if (session.workoutType === "strength") {
      load.upperBodyLoad += session.upperBodySets ?? 0;
      load.lowerBodyLoad += session.lowerBodySets ?? 0;
    } else if (session.workoutType === "volleyball") {
      load.lowerBodyLoad += session.durationMinutes * VOLLEYBALL_LOWER_BODY_LOAD_PER_MINUTE;
      load.highImpactLoad += session.durationMinutes * VOLLEYBALL_HIGH_IMPACT_LOAD_PER_MINUTE;
    }
  }

  return load;
}

/** Flags a specific pattern the brief calls out by name: heavy lower-body lifting
 * immediately followed by a high-impact volleyball session, as evidence to surface —
 * never to auto-adjust the plan (brief: "Do not automatically change the training
 * plan; present evidence"). */
export function hasHeavyLowerBodyFollowedByHighImpact(
  sessionsInOrder: { date: string; workoutType: SessionLoadInput["workoutType"]; lowerBodySets?: number }[],
  heavyLowerBodySetThreshold = 12,
): { precedingDate: string; followingDate: string }[] {
  const flagged: { precedingDate: string; followingDate: string }[] = [];
  for (let i = 0; i < sessionsInOrder.length - 1; i++) {
    const current = sessionsInOrder[i]!;
    const next = sessionsInOrder[i + 1]!;
    const isHeavyLowerBody =
      current.workoutType === "strength" && (current.lowerBodySets ?? 0) >= heavyLowerBodySetThreshold;
    if (isHeavyLowerBody && next.workoutType === "volleyball") {
      flagged.push({ precedingDate: current.date, followingDate: next.date });
    }
  }
  return flagged;
}
