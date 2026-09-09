# Data Model

Dexie/IndexedDB. Every table's primary key is a client-generated UUIDv4 string.
Every entity has `createdAt`/`updatedAt` (ISO-8601 UTC). Raw tables are listed first,
derived tables second (see ARCHITECTURE.md §6 for the raw/derived distinction).

Zod schemas mirror every interface below 1:1, in `src/storage/schemas/`, and are the
only way data enters a table (both from UI forms and from import/parse paths).

## Raw / logged entities

### UserProfile (single row)
```ts
interface UserProfile {
  id: "default";
  dateOfBirth: ISODate | null;
  sex: "female" | "male" | "intersex" | "prefer_not_to_say";
  heightCm: number | null;
  currentWeightLb: number;
  restingHeartRate: number | null;
  observedMaxHeartRate: number | null;
  preferredUnits: "imperial" | "metric";
  calorieGoal: number;      // weekly-average target, e.g. 2500
  proteinGoalG: number;     // e.g. 120
  fiberGoalG: number;       // e.g. 30
  weightGoal: "gain_muscle" | "lose_fat" | "maintain" | "performance";
  trainingSchedule: DayOfWeekPlan[]; // see below
  addExerciseCaloriesToBudget: boolean; // off by default, same rule as health-tracker
  contraception: { hormonal: boolean; type: string | null };
}

interface DayOfWeekPlan {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  activityType: "lifting" | "volleyball" | "recovery" | "rest" | "other";
  calorieTarget: number | null; // null = use the activity-type default (see nutrition domain)
}
```

### DailyMetrics (one row per date)
```ts
interface DailyMetrics {
  id: string;
  date: ISODate;
  weightLb: number | null;
  steps: number | null;
  restingHeartRate: number | null;
  sleepDurationMinutes: number | null;
  sleepQuality: 1 | 2 | 3 | 4 | 5 | null;
  activeEnergyKcal: number | null;
  totalEnergyKcal: number | null;
  perceivedEnergy: 1 | 2 | 3 | 4 | 5 | null;
  hunger: 1 | 2 | 3 | 4 | 5 | null;
  soreness: 1 | 2 | 3 | 4 | 5 | null;
  stress: 1 | 2 | 3 | 4 | 5 | null;
  mood: 1 | 2 | 3 | 4 | 5 | null;
  notes: string | null;
}
```

### Workout (base row for every session; strength/volleyball extend it 1:1)
```ts
interface Workout {
  id: string;
  source: "apple_health" | "strong" | "manual";
  sourceWorkoutId: string | null; // dedup key with `source`, same pattern as health-tracker
  workoutType: "strength" | "volleyball" | "run" | "other";
  startTime: ISODateTime;
  endTime: ISODateTime | null;
  durationMinutes: number;
  activeCaloriesKcal: number | null;   // as reported by the source
  totalCaloriesKcal: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  hrZones: { zone: 1 | 2 | 3 | 4 | 5; minutes: number }[] | null;
  perceivedExertion: number | null; // RPE 1-10
  notes: string | null;
}
```

### StrengthWorkout (extends Workout 1:1 via workoutId)
```ts
interface StrengthWorkout {
  workoutId: string;
  exercises: StrengthExercise[];
}
interface StrengthExercise {
  id: string;
  name: string;
  orderIndex: number;
  sets: StrengthSet[];
}
interface StrengthSet {
  id: string;
  orderIndex: number;
  weightLb: number | null;
  reps: number | null;
  rir: number | null;
  rpe: number | null;
  restSeconds: number | null;
  isPr: boolean;
}
```

### VolleyballSession (extends Workout 1:1 via workoutId)
```ts
interface VolleyballSession {
  workoutId: string;
  format: "6v6" | "6v4" | "beach" | "other";
  activePlayMinutes: number | null;
  passiveRestMinutes: number | null;
  warmupActivity: string | null;
  jumpVolume: "low" | "moderate" | "high" | null;
  role: string | null;
  // Apple's number vs. this app's own model — see domain/training/volleyballModel.ts.
  appleActiveCaloriesKcal: number | null;
  modelEstimate: DerivedMetric<number> | null; // rangeLow/rangeHigh/confidence populated
  notes: string | null;
}
```

### NutritionDay (one row per date — targets only; actuals are computed from FoodEntry)
```ts
interface NutritionDay {
  id: string;
  date: ISODate;
  calorieTarget: number;         // resolved activity-adjusted target for this day
  proteinTargetG: number;
  fiberTargetG: number;
  carbTargetG: number | null;
  fatTargetG: number | null;
  targetSource: "estimated" | "calibrated" | "manual_override";
}
```

### FoodEntry
```ts
interface FoodEntry {
  id: string;
  timestamp: ISODateTime;
  date: ISODate; // local calendar day, same reasoning as health-tracker's meal_entries
  rawText: string | null;
  parsedFoods: ParsedFoodItem[];
  source: "manual" | "restaurant_estimate" | "packaged_nutrition" | "photo" | "ai_parsed";
  notes: string | null;
}
interface ParsedFoodItem {
  name: string;
  calories: number;
  calorieRangeLow: number | null;
  calorieRangeHigh: number | null;
  proteinG: number;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number;
  confidence: "low" | "medium" | "high";
}
```

### SymptomEntry
```ts
interface SymptomEntry {
  id: string;
  dateTime: ISODateTime;
  bodyArea: string; // free text + a curated suggestion list in the UI, not a rigid enum
  symptomType:
    | "pain" | "tightness" | "snapping" | "numbness" | "soreness"
    | "swelling" | "stiffness" | "headache" | "fatigue" | "other";
  severity: number; // 0-10
  laterality: "left" | "right" | "bilateral" | "n/a";
  trigger: string | null;
  durationMinutes: number | null;
  impactOnTraining: "none" | "modified" | "shortened" | "skipped" | null;
  notes: string | null;
  /** Safety flag surfaced by the UI's configurable rules (see IMPLEMENTATION_PLAN.md
   * "Return-to-run"/"Symptom tracker") — never a diagnosis, just a "consider seeing a
   * clinician" nudge above a severity/frequency threshold the user can tune. */
  flaggedForReview: boolean;
}
```

### RunSession
```ts
interface RunSession {
  id: string;
  workoutId: string | null; // links to Workout if HR/duration came from a device
  protocol: string; // e.g. "4 min walk / 1 min run x6"
  intervals: { type: "walk" | "run"; minutes: number; symptomsDuring: string | null }[];
  distanceMiles: number | null;
  paceMinPerMile: number | null;
  averageHeartRate: number | null;
  symptomsAfter: string | null;
  nextDaySymptoms: string | null;
  progressionStatus: "green" | "yellow" | "red" | null; // per configurable rules
}
```

### SkinEntry
```ts
interface SkinEntry {
  id: string;
  date: ISODate;
  acneSeverity: 0 | 1 | 2 | 3 | 4;
  breakoutAreas: string[];
  lesionType: string | null;
  dryness: 0 | 1 | 2 | 3 | null;
  irritation: 0 | 1 | 2 | 3 | null;
  photoBlobId: string | null; // IndexedDB blob store, local only, never uploaded
  skincareProductsUsed: string[];
  notes: string | null;
}
```

### SkincareChange
```ts
interface SkincareChange {
  id: string;
  date: ISODate;
  product: string;
  action: "started" | "stopped";
  reason: string | null;
}
```

### MenstrualCycleEntry (one row per logged date)
```ts
interface MenstrualCycleEntry {
  id: string;
  date: ISODate;
  bleeding: "none" | "spotting" | "light" | "medium" | "heavy";
  periodStart: boolean;
  periodEnd: boolean;
  cramps: number | null;          // 0-10
  breastTenderness: number | null;
  bloating: number | null;
  headache: number | null;
  fatigue: number | null;
  mood: number | null;
  irritability: number | null;
  cravings: string[] | null;
  hunger: number | null;
  sleepDisruption: number | null;
  giSymptoms: string[] | null;
  acneFlare: boolean | null;
  libido: number | null;                 // optional
  cervicalMucus: string | null;           // optional
  ovulationTestResult: "positive" | "negative" | "not_tested" | null; // optional
  basalBodyTempF: number | null;          // optional
  notes: string | null;
}
```

## Derived entities

### Cycle (computed from MenstrualCycleEntry rows, recomputed on demand — never hand-edited)
```ts
interface Cycle {
  id: string;
  startDate: ISODate;
  endDate: ISODate | null; // null while still in progress
  cycleLengthDays: number | null;
  periodLengthDays: number | null;
  estimatedOvulationDate: DerivedMetric<ISODate> | null;
  follicularPhaseRange: { start: ISODate; end: ISODate } | null;
  lutealPhaseRange: { start: ISODate; end: ISODate } | null;
  phaseConfidence: "high" | "medium" | "low";
  isRegular: boolean | null; // null until >= 3 cycles observed
  algorithmVersion: string;
}
```
Confidence rule (brief's exact tiers), implemented once in
`src/domain/cycle/phaseConfidence.ts`:
- **high**: directly logged period start + an ovulation indicator (BBT shift, positive
  LH test, or explicit ovulation marker) this cycle.
- **medium**: regular cycle history (>= 3 cycles, low variance) with no direct
  ovulation indicator this cycle — ovulation date is inferred from typical luteal
  length.
- **low**: irregular or sparse cycle history, or fewer than 3 cycles logged.
- Hormonal contraception present -> phase estimation is suppressed/qualified
  everywhere it would otherwise assume a natural cycle (brief's explicit requirement).

### DerivedMetric<T> (generic wrapper, used across volleyball model, weight trend, etc.)
```ts
interface DerivedMetric<T> {
  name: string;
  value: T;
  rangeLow?: T;
  rangeHigh?: T;
  confidence: "exploratory" | "low" | "moderate" | "high";
  sources: string[];
  algorithmVersion: string;
  computedAt: ISODateTime;
}
```

### Insight (output of the insights engine — see domain/insights/)
```ts
interface Insight {
  id: string;
  kind: "observation" | "correlation" | "hypothesis" | "recommendation";
  text: string;
  domain: "nutrition" | "training" | "recovery" | "cycle" | "skin" | "symptoms" | "mood";
  confidence: "exploratory" | "low" | "moderate" | "high";
  sampleSize: { cycles?: number; sessions?: number; days?: number };
  effectSize: number | null;
  relatedEntityIds: string[];
  generatedAt: ISODateTime;
  algorithmVersion: string;
}
```

### WeeklyReport (one row per ISO week, regenerable)
```ts
interface WeeklyReport {
  id: string;
  weekStartDate: ISODate;
  nutritionSummary: { avgCalories: number; avgProteinG: number; avgFiberG: number; avgCarbsG: number; targetAdherencePct: number };
  trainingSummary: { liftingSessions: number; volleyballMinutes: number; avgSteps: number; trainingLoadScore: number };
  weightSummary: { sevenDayAvg: number; trendSlopePerWeek: number };
  recoverySummary: { avgSleepMinutes: number; avgRestingHeartRate: number | null; avgSoreness: number | null; avgEnergy: number | null };
  cycleSummary: { cycleDay: number | null; periodStatus: string | null; notablePatterns: string[] };
  skinSummary: { acneTrend: "improving" | "stable" | "worsening" | "insufficient_data" };
  topRecommendations: Insight[]; // max 3, per brief
  generatedAt: ISODateTime;
}
```

## Entity-relationship summary

```
Workout 1---1 StrengthWorkout 1---* StrengthExercise 1---* StrengthSet
Workout 1---1 VolleyballSession
MenstrualCycleEntry (many, by date) -> Cycle (derived, recomputed)
FoodEntry -> NutritionDay (by date, actuals computed on read, not stored redundantly)
Insight, WeeklyReport, DerivedMetric<T>: derived/cache tables, always safe to
  recompute from raw tables + algorithmVersion
```

## Import/export

- **JSON export**: every raw table, verbatim, plus a top-level `schemaVersion`. This is
  the full-fidelity backup/restore format (brief §"local-first" + "export/import").
  Photo blobs are included as base64 inside the JSON export (acceptable for MVP scale;
  revisit if photo volume makes exports unwieldy).
- **JSON import**: validated per-entity through the same Zod schemas as live writes —
  an import is not a trusted bulk-insert, it goes through the same validation path as
  any other write.
- **Apple Health export import**: `export.xml` -> `AppleHealthExportAdapter` parses
  Workout/HR/steps/sleep records into the raw tables above, tagging `source:
  "apple_health"` and deduping via `(source, sourceWorkoutId)`.
- **Strong CSV import**: `StrongCsvAdapter` maps Strong's CSV columns to
  `StrengthWorkout`/`StrengthExercise`/`StrengthSet`, isolated from the core workout
  model per ARCHITECTURE.md §8.4.
