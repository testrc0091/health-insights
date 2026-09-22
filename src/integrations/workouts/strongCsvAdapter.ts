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

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Strong's per-workout "Share" text (the app's Share button on a finished workout —
 * distinct from the full-history CSV export in Settings) prints its date/time like
 * "Tuesday, September 22, 2026 at 11:44 AM". `new Date(...)` parses that inconsistently
 * across engines (V8 is lenient, Safari/JavaScriptCore often returns Invalid Date for
 * this exact shape), so it's parsed explicitly instead of trusted to the built-in
 * parser — a silent Invalid Date here would surface much later as a NaN timestamp. */
function parseShareTextDate(line: string): Date | null {
  const match = line.match(/^\w+,\s*(\w+)\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) return null;
  const [, monthName, day, year, hour12Str, minute, ampm] = match;
  const monthIndex = MONTH_NAMES.indexOf(monthName!.toLowerCase());
  if (monthIndex === -1) return null;
  const hour12 = Number(hour12Str);
  const hour24 = (hour12 % 12) + (ampm!.toUpperCase() === "PM" ? 12 : 0);
  const date = new Date(Number(year), monthIndex, Number(day), hour24, Number(minute));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Recognizes a "Set N: <detail>" line's detail as either a loaded set ("225 lb × 10",
 * accepting a plain "x" too since not every keyboard/paste preserves the "×" glyph) or
 * a bodyweight/reps-only set ("10 reps"). Falls back to a set with no weight/reps
 * recorded rather than dropping it — an unparseable detail still means a set happened,
 * so the count stays right even if this one entry's numbers don't. */
function parseShareTextSetDetail(detail: string): { weightLb: number | null; reps: number | null } {
  const loaded = detail.match(/^([\d.]+)\s*lb\s*[×x]\s*(\d+)/i);
  if (loaded) return { weightLb: Number(loaded[1]), reps: Number(loaded[2]) };
  const bodyweight = detail.match(/^(\d+)\s*reps?\b/i);
  if (bodyweight) return { weightLb: null, reps: Number(bodyweight[1]) };
  return { weightLb: null, reps: null };
}

/**
 * Parses Strong's per-workout "Share" text — what you get from the Share button on a
 * finished workout (Copy or Share sheet), not the full CSV export. Format:
 *   <workout title>
 *   <weekday>, <Month> <day>, <year> at <h>:<mm> <AM|PM>
 *   (blank line)
 *   <exercise name>
 *   Set 1: <weight> lb × <reps>        (or "Set 1: <reps> reps" for bodyweight)
 *   ...
 *   Notes: <text>                       (optional, attaches to the exercise just above)
 *   (blank line between exercises)
 *   ...
 *   https://link.strong.app/...          (share link, ignored)
 * There's no per-exercise notes field in the data model (DATA_MODEL.md's
 * StrengthExercise has none), so any "Notes:" lines are folded into the workout-level
 * `notes`, prefixed with which exercise they followed.
 */
function parseStrongShareText(text: string): StrongImportResult {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => !/^https?:\/\/\S+$/i.test(line.trim()));

  const nonBlank = lines.map((l, i) => ({ line: l.trim(), i })).filter((l) => l.line.length > 0);
  if (nonBlank.length < 2) {
    return { workouts: [], strengthWorkouts: [], warnings: ["No workout data found in this text."] };
  }

  const title = nonBlank[0]!.line;
  const dateLine = nonBlank[1]!.line;
  const parsedDate = parseShareTextDate(dateLine);
  const warnings: string[] = [];
  if (!parsedDate) {
    warnings.push(`Couldn't parse the date "${dateLine}" — using the import time instead.`);
  }
  const startTime = (parsedDate ?? new Date()).toISOString();

  const bodyStartIndex = nonBlank[1]!.i + 1;
  const exercises: StrengthExercise[] = [];
  const notesParts: string[] = [];
  let currentName: string | null = null;
  let currentSets: StrengthSet[] = [];

  function flushCurrentExercise() {
    if (currentName) {
      exercises.push({ id: uuid(), name: currentName, orderIndex: exercises.length, sets: currentSets });
    }
  }

  for (let i = bodyStartIndex; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.length === 0) continue;

    const setMatch = line.match(/^Set\s+(\d+):\s*(.*)$/i);
    if (setMatch) {
      if (!currentName) continue; // a set line with no preceding exercise name — ignore, don't crash
      const { weightLb, reps } = parseShareTextSetDetail(setMatch[2]!);
      currentSets.push({
        id: uuid(),
        orderIndex: Number(setMatch[1]) - 1,
        weightLb,
        reps,
        rir: null,
        rpe: null,
        restSeconds: null,
        isPr: false,
      });
      continue;
    }

    const notesMatch = line.match(/^Notes?:\s*(.*)$/i);
    if (notesMatch) {
      notesParts.push(currentName ? `${currentName}: ${notesMatch[1]}` : notesMatch[1]!);
      continue;
    }

    // Anything else at this point is a new exercise name heading.
    flushCurrentExercise();
    currentName = line;
    currentSets = [];
  }
  flushCurrentExercise();

  if (exercises.length === 0) {
    return { workouts: [], strengthWorkouts: [], warnings: ["Couldn't find any exercises in this text."] };
  }

  const workoutId = uuid();
  return {
    workouts: [
      {
        id: workoutId,
        source: "strong",
        sourceWorkoutId: `share:${startTime}|${title}`,
        label: title,
        workoutType: "strength",
        startTime,
        endTime: null,
        durationMinutes: 0,
        activeCaloriesKcal: null,
        totalCaloriesKcal: null,
        averageHeartRate: null,
        maxHeartRate: null,
        hrZones: null,
        perceivedExertion: null,
        notes: notesParts.length > 0 ? notesParts.join(" | ") : null,
      },
    ],
    strengthWorkouts: [{ workoutId, exercises }],
    warnings,
  };
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
      label: idx.workoutName >= 0 ? first[idx.workoutName] || null : null,
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

/** Entry point for both import paths (file upload and paste). Strong exposes two
 * completely different text formats depending on which button you use in the app —
 * the full-history CSV from Settings → Export Data, and the single-workout "Share"
 * text from the Share button on a finished session — and there's no shared header to
 * dispatch on cleanly, so this tries the CSV parser first and only falls back to the
 * share-text parser when the input actually looks like that format (a "Set N:" line
 * present) rather than on every CSV-parse failure, so a genuinely malformed/empty
 * paste still gets the CSV parser's own clearer warning instead of a wrong one. */
export function parseStrongExport(text: string): StrongImportResult {
  const csvResult = parseStrongCsv(text);
  if (csvResult.workouts.length > 0) return csvResult;

  const looksLikeShareText = /^Set\s+\d+:/im.test(text);
  if (looksLikeShareText) return parseStrongShareText(text);

  return csvResult;
}
