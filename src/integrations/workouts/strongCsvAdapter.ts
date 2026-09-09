import { v4 as uuid } from "uuid";
import type { StrengthExercise, StrengthSet, StrengthWorkout, Workout } from "../../storage/schemas/workout";

export interface StrongImportResult {
  workouts: Workout[];
  strengthWorkouts: StrengthWorkout[];
  warnings: string[];
}

/** Minimal CSV parser handling quoted fields with embedded commas — sufficient for
 * Strong's own export format, without adding a CSV-parsing dependency. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/** Strong's Duration column is formatted like "1h 5m" or "45m", never a plain number. */
function parseDurationMinutes(raw: string | undefined): number {
  if (!raw) return 0;
  const hourMatch = raw.match(/(\d+)h/);
  const minMatch = raw.match(/(\d+)m/);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minMatch ? Number(minMatch[1]) : 0;
  return hours * 60 + minutes;
}

function numOrNull(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses a Strong app CSV export. Strong has no public stable API as of this writing
 * (ARCHITECTURE.md §8.4), so CSV import is the supported integration path, isolated
 * behind this one adapter — swapping in a real API later touches only this file.
 * Expected header row: Date, Workout Name, Duration, Exercise Name, Set Order,
 * Weight, Reps, Distance, Seconds, Notes, Workout Notes, RPE.
 */
export function parseStrongCsv(csvText: string): StrongImportResult {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return { workouts: [], strengthWorkouts: [], warnings: ["No data rows found in this CSV."] };
  }

  const header = rows[0]!.map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    date: col("Date"),
    workoutName: col("Workout Name"),
    duration: col("Duration"),
    exerciseName: col("Exercise Name"),
    setOrder: col("Set Order"),
    weight: col("Weight"),
    reps: col("Reps"),
    rpe: col("RPE"),
    workoutNotes: col("Workout Notes"),
  };
  if (idx.date === -1 || idx.exerciseName === -1) {
    return {
      workouts: [],
      strengthWorkouts: [],
      warnings: ["This doesn't look like a Strong export — missing Date/Exercise Name columns."],
    };
  }

  const sessionKey = (row: string[]) => `${row[idx.date]}|${row[idx.workoutName]}`;
  const sessions = new Map<string, string[][]>();
  for (const row of rows.slice(1)) {
    const key = sessionKey(row);
    const existing = sessions.get(key) ?? [];
    existing.push(row);
    sessions.set(key, existing);
  }

  const workouts: Workout[] = [];
  const strengthWorkouts: StrengthWorkout[] = [];

  for (const sessionRows of sessions.values()) {
    const first = sessionRows[0]!;
    const startTime = new Date(first[idx.date]!).toISOString();
    const durationMinutes = parseDurationMinutes(idx.duration >= 0 ? first[idx.duration] : undefined);
    const workoutId = uuid();

    const setsByExercise = new Map<string, StrengthSet[]>();
    const exerciseOrder: string[] = [];
    for (const row of sessionRows) {
      const name = row[idx.exerciseName] || "Unknown exercise";
      if (!setsByExercise.has(name)) {
        setsByExercise.set(name, []);
        exerciseOrder.push(name);
      }
      const sets = setsByExercise.get(name)!;
      sets.push({
        id: uuid(),
        orderIndex: numOrNull(row[idx.setOrder]) ?? sets.length,
        weightLb: numOrNull(row[idx.weight]),
        reps: numOrNull(row[idx.reps]),
        rir: null,
        rpe: idx.rpe >= 0 ? numOrNull(row[idx.rpe]) : null,
        restSeconds: null,
        isPr: false,
      });
    }

    const exercises: StrengthExercise[] = exerciseOrder.map((name, i) => ({
      id: uuid(),
      name,
      orderIndex: i,
      sets: setsByExercise.get(name)!,
    }));

    workouts.push({
      id: workoutId,
      source: "strong",
      sourceWorkoutId: sessionKey(first),
      workoutType: "strength",
      startTime,
      endTime: null,
      durationMinutes,
      activeCaloriesKcal: null,
      totalCaloriesKcal: null,
      averageHeartRate: null,
      maxHeartRate: null,
      hrZones: null,
      perceivedExertion: null,
      notes: idx.workoutNotes >= 0 ? first[idx.workoutNotes] || null : null,
    });
    strengthWorkouts.push({ workoutId, exercises });
  }

  return { workouts, strengthWorkouts, warnings: [] };
}
