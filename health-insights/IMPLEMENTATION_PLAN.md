# Implementation Plan

## Environment note

Same environment as the `health-tracker` project: this Windows machine has no
Node.js installed, and per your instruction none is being installed for this session
either — everything below is written source, not run/tested/type-checked here. Unlike
`health-tracker`, this project has **no Mac/Xcode dependency at all** — it's a pure
PWA, so once Node exists anywhere (this machine or another), `npm run dev` and
`npm run build` are the entire toolchain. "Add to Home Screen" in mobile Safari is
the install path; no App Store, no provisioning profile, no Xcode.

## MVP screen map

Tabs (bottom nav on mobile): **Today · Nutrition · Training · Cycle · Trends · Inbox**

- **Today** — the brief's home-screen dashboard: today/activity type, cycle day +
  phase (confidence-labeled), calorie/protein/fiber cards with a "recovery priority"
  nutrient callout, today's workout + recent training load, recovery snapshot
  (sleep/RHR/soreness/energy), cycle-context card (only shown when personal data
  supports a pattern — never generic cycle advice).
- **Nutrition** — the "What did you eat?" NL entry box (voice input deferred to
  Phase 3), FoodEntry review/edit, calorie/protein/fiber/carb progress, "What should I
  eat next?" recommendation card, weight trend chart with cycle-phase overlay.
- **Training** — weekly training-load calendar, strength progression (goal-specific
  cards: first pull-up, bench, vertical-jump support, lower-body), volleyball
  sessions with Apple-vs-model calorie estimate, manual workout entry, Strong CSV
  import.
- **Cycle** — period/symptom logging, current `Cycle` (phase + confidence), cycle
  comparison chart (overlay last 3-6 cycles by cycle-day), cycle-adjusted weight view.
- **Trends** — cross-domain charts (§DATA_MODEL "Import/export" not relevant here):
  weight trend, calorie-vs-target, protein/fiber consistency, volleyball workload,
  strength progression, cycle dashboards, acne-vs-cycle-day, appetite-vs-cycle-day,
  training-performance-vs-phase.
- **Inbox** — the universal "What's going on?" input; splits free text into
  draft Workout/FoodEntry/SymptomEntry/MenstrualCycleEntry rows and shows a
  confirmation screen before committing anything (brief's explicit requirement — never
  auto-commit a multi-domain parse).
- A **Health** tab/section (symptoms, skin, return-to-run) is reachable from Training
  or Cycle rather than adding a 7th bottom-nav item, keeping navigation depth limited
  per the same UX principle health-tracker used. Onboarding and Settings (data export/
  import, goals, training schedule) are reachable from Today, not separate tabs.

## Phase 1 — Scaffold + core loop (this session's implementation target)

1. **Domain layer**, pure + unit-tested:
   - `nutrition/activityAdjustedTarget.ts` — resolves a day's calorie/protein/fiber
     target from `UserProfile.trainingSchedule` + activity type, per the brief's
     Mon-Sun example (lifting ~2400, volleyball ~2750-2950, recovery lower).
   - `nutrition/calibration.ts` — 3-4 week weight-trend-vs-goal check, proposes a
     ±100-150 kcal/day adjustment; produces "estimated" vs "calibrated" target,
     never silently overwrites the estimated target.
   - `weight/trend.ts` — 7-day rolling average, trend slope, cycle-day comparison
     view (same cycle-day across prior cycles).
   - `training/load.ts` — weekly training load aggregation (upper/lower/high-impact
     buckets; volleyball counts toward lower-body/high-impact load even with no
     Strong data for that day).
   - `cycle/phaseEstimation.ts` + `cycle/phaseConfidence.ts` — the exact confidence
     tiers from DATA_MODEL.md, contraception-aware suppression of natural-cycle
     assumptions.
   - `insights/confidenceThresholds.ts` — the brief's exact sample-size table
     (<2 cycles exploratory, 2-3 weak/low, 4-6 moderate, >6 higher; sessions-based
     for non-cycle associations), used by every insight the engine produces.
   - `insights/engine.ts` — observation/correlation/hypothesis/recommendation
     pipeline over whatever domain functions above have already computed; Phase 1
     ships the pipeline + a handful of concrete analyzers (nutrition-vs-target,
     weight-vs-cycle-window); most of the "cross-analysis" breadth in the brief
     (acne-vs-cycle, symptoms-vs-volleyball, etc.) is Phase 2 analyzers plugged into
     this same pipeline, not new architecture.
2. **Storage layer**: Dexie schema for every DATA_MODEL.md table, one repository per
   entity cluster, Zod validation on every write.
3. **Integration layer stubs**: `HealthDataAdapter` (ManualAdapter working now;
   AppleHealthExportAdapter and ShortcutsAdapter are Phase 2), `WorkoutSourceAdapter`
   (ManualAdapter working now; StrongCsvAdapter is Phase 2), on-device heuristic
   `NutritionParser` (no AI, no network — a real, if simple, working parser so the
   Inbox/Nutrition NL entry is usable from day one; see "documented assumptions"
   below for its limits).
4. **App composition**: seed ~2-3 weeks of demo data across every domain (so Trends/
   Cycle/Training aren't empty), onboarding flow, settings.
5. **UI**: all six tabs functional at MVP depth (per screen map above), weekly report
   generation, JSON export/import.
6. **Tests**: brief's exact worked examples wherever it gives one (the activity-
   adjusted weekly calorie distribution, the confidence-tier thresholds, the
   weight-vs-cycle "no calorie adjustment recommended yet" framing), plus training
   load aggregation and cycle phase confidence tiering.

## Phase 2 — Real ingestion + cross-domain analysis

1. `AppleHealthExportAdapter` (parse `export.xml`), `ShortcutsAdapter` (accept a JSON
   payload from an iOS Shortcut via a documented URL scheme/share-sheet target).
2. `StrongCsvAdapter`.
3. Volleyball active-calorie personal model (starts from the brief's 400-450 kcal/hr
   prior, recalibrates from HR/duration/format across logged sessions).
4. Full cross-analysis analyzer set: training-vs-cycle, recovery-vs-cycle,
   nutrition-vs-cycle, weight-vs-cycle, skin-vs-cycle, symptoms-vs-cycle,
   mood-vs-cycle — each a small analyzer registered with the Phase 1 insights engine,
   each independently unit-testable against the same confidence thresholds.
5. Symptom tracker (body map UI) + skincare timeline UI.

## Phase 3 — Input richness + personalization

1. Voice input (Web Speech API in-browser — no native shell here, so this is the
   browser API directly, same caveat as health-tracker's web fallback: not on-device
   recognition, used only because there's no native alternative in a pure PWA).
2. Photo food logging (attach a photo to a FoodEntry; no automatic recognition unless
   the opt-in AI path is enabled).
3. Opt-in AI parser for the Inbox/Nutrition NL entry, clearly labeled per entry
   (`source: "ai_parsed"`), fully removable without breaking the app (the on-device
   heuristic parser remains the default and the fallback).
4. Return-to-run protocol tracking with configurable green/yellow/red rules.
5. Cycle-adjusted weight analytics (deeper version of Phase 1's cycle-day comparison).
6. Automated correlation surfacing (proactively surfacing an insight once it crosses
   a confidence threshold, rather than only on-demand in Trends).

## Documented assumptions

- Week starts Monday, matching the brief's own Mon-Sun activity example.
- The Phase 1 on-device `NutritionParser` is a heuristic keyword/quantity matcher
  (same approach as health-tracker's `MockNutritionProvider`), not an LLM — it will
  visibly under-parse unusual foods and mark them as low-confidence estimates rather
  than fabricate precision. This is a real, usable parser, not a placeholder; the
  brief's opt-in AI parser (Phase 3) is a strictly-better *option*, not a prerequisite
  for the Inbox/Nutrition features to work.
- "Exercise calories added back to budget" defaults off, same rule and reasoning as
  health-tracker.
- Cycle phase estimation never asserts pregnancy/fertility claims; ovulation date is
  always shown as an estimate with its confidence tier directly attached, and is
  suppressed/qualified under hormonal contraception per DATA_MODEL.md.
- The insights engine will legitimately produce **no output** for most analyzers in
  the first few weeks (Phase 1, seed data aside) — this is correct behavior per the
  brief's "never overstate sparse data" requirement, not a bug to fix by lowering
  thresholds.
- Symptom/return-to-run "flags" are configurable heuristics that surface a "consider
  clinical review" nudge; they are never framed as a diagnosis anywhere in copy.
