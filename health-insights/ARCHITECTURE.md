# Architecture

## 1. Summary

A local-first Progressive Web App that combines nutrition, strength training,
volleyball/cardio activity, recovery, symptoms, skin, and menstrual-cycle data into one
model, and answers "what does this mean and what should I do next" rather than just
logging numbers. Everything lives in IndexedDB on-device by default. No account, no
server, no third-party data sharing required to use the app. Any future AI/network
feature is opt-in and clearly labeled, and is architected as an isolated, swappable
layer so the rest of the app never depends on it being enabled.

This is a **separate project from `health-tracker`** (the earlier Capacitor/HealthKit
iOS app). That project's architecture (native shell + Swift HealthKit bridge) is a
different, incompatible approach from this one (pure web PWA). See §2 for why a PWA is
the right call *here* even though it wasn't for that project's requirements.

## 2. Why a pure PWA (not Capacitor, not React Native, not native)

The earlier `health-tracker` project chose Capacitor + a native Swift bridge
specifically *because* it needed real HealthKit read access, which Safari/PWA cannot
provide. This project's brief is explicit that Apple Health ingestion happens via
**export/Shortcuts/manual import**, not a live HealthKit query — so the one reason to
leave pure-web doesn't apply here. Given that:

| Option | Verdict | Reason |
|---|---|---|
| Pure PWA (React/TS, installable, offline, IndexedDB) | **Chosen** | No native shell to build/maintain, works on Windows/any dev machine (no Xcode required), installs to iPhone home screen via Safari "Add to Home Screen," fully offline-capable via a service worker. Matches the brief's explicit requirement. |
| Capacitor + native bridge (like health-tracker) | Rejected here | Would only be justified by needing live HealthKit queries, which this brief deliberately avoids. Adds an Xcode/Mac dependency for zero benefit. |
| React Native | Rejected | Same reasoning as health-tracker's ARCHITECTURE.md — no benefit over a well-built responsive web app for this use case, and it isn't installable as a lightweight PWA. |

**Consequence, stated plainly (brief's own "APPLE HEALTH LIMITATION" section):** this
app cannot read Apple Health data live. It ingests health data three ways, all
supported by the same internal `HealthDataAdapter` interface so none of this is a
later rewrite:
1. **Manual import** of an Apple Health export (the `export.xml` from Health app's
   "Export All Health Data") — parsed client-side, entirely offline.
2. **Shortcuts-based transfer** — an iOS Shortcut the user runs that reads specific
   HealthKit types and hands them to the PWA as JSON (via a share sheet / URL scheme /
   pasted text) — documented in README, not built as custom native code.
3. **A future native iOS wrapper** (i.e., doing what `health-tracker` already does) —
   left as a described upgrade path, not built now.

Strong (the strength-training app) has no public stable API as of this writing, so the
brief's own fallback applies: CSV export import, behind a `WorkoutSourceAdapter`
interface, isolated from the core workout model (§8 "Strong integration").

## 3. High-level component diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│ Browser / installed PWA (Safari on iPhone, or any browser in dev)      │
│                                                                          │
│  UI (screens) ── never contains calculations or statistics             │
│       │                                                                 │
│  Domain logic (pure TS, unit-tested, no I/O)                            │
│   - nutrition targets & activity-adjusted calorie model                │
│   - weight trend / rolling average / cycle-day comparison              │
│   - training load aggregation                                          │
│   - insights engine (observation -> correlation -> hypothesis ->       │
│     recommendation, with confidence thresholds)                        │
│   - cycle phase estimation + confidence                                │
│       │                                                                 │
│  Storage layer (Dexie/IndexedDB) ── all persistence, one repository    │
│  per entity, raw vs. derived data kept in separate tables (§7)         │
│       │                                                                 │
│  Integration layer (swappable adapters)                                │
│   - HealthDataAdapter: AppleHealthExportAdapter / ShortcutsAdapter /    │
│     ManualAdapter                                                       │
│   - WorkoutSourceAdapter: StrongCsvAdapter / ManualAdapter              │
│   - NutritionParser: on-device heuristic parser (MVP) / future LLM      │
│     parser behind an explicit opt-in + clear "AI parsed" label          │
└──────────────────────────────────────────────────────────────────────┘
       │ optional, off by default
       ▼
┌──────────────────────────────┐
│ Future opt-in AI endpoint      │  <-- never required, never default-on
│ (only for NL parsing, clearly  │
│ labeled "AI parsed" per entry) │
└──────────────────────────────┘
```

## 4. Tech stack

- **UI**: React + TypeScript, Vite. Tailwind for styling (fast to build a calm,
  data-dense mobile UI without hand-rolling every utility class — a deliberate
  difference from health-tracker's hand-written CSS, since this app has far more
  screens/charts to keep visually consistent).
- **Routing**: React Router, tab-based (`Today`, `Nutrition`, `Training`, `Cycle`,
  `Trends`, `Inbox`), matching the brief's suggested tab map.
- **Storage**: Dexie (a well-maintained IndexedDB wrapper) — chosen over raw
  IndexedDB for schema versioning/migrations and a much less error-prone query API,
  and over `@capacitor-community/sqlite` (health-tracker's choice) because there is no
  native shell here to give that plugin a real SQLite engine to talk to; Dexie is the
  right IndexedDB-native tool for a pure-web app.
- **Schema validation**: Zod, at every storage boundary (write path) and every import
  boundary (JSON import, Apple Health export parse, CSV parse) — untrusted/parsed data
  is validated before it becomes a domain object anywhere in the app.
- **Charts**: Recharts (lightweight, composable, good mobile behavior).
- **Dates**: date-fns (cycle-day math, rolling averages, week boundaries).
- **PWA/offline**: `vite-plugin-pwa` (Workbox under the hood) — precaches the app
  shell so it loads offline after first visit, with a web app manifest for "Add to
  Home Screen."
- **Testing**: Vitest for the domain layer (pure functions: nutrition targeting,
  weight trend, training load, insights-engine confidence thresholds, cycle phase
  estimation) — the same "test the math, not the UI" approach as health-tracker.

## 5. Layering rule

```
src/ui             -> may import src/domain, src/app types
src/domain         -> pure TypeScript, ZERO imports from ui/storage/integrations
src/storage        -> may import src/domain (types), Zod schemas
src/integrations   -> may import src/domain (types) only — never storage directly
src/app            -> composition root; wires storage + integrations + domain
                      into the UI via React context
```

Same discipline as health-tracker: every derived number the app shows (calorie
target, cycle phase, insight, correlation) is computed in `src/domain`, is
independently unit-testable, and is never computed inline inside a component.

## 6. Raw vs. derived data (brief's explicit requirement)

Two parallel table families:

- **Raw/imported/logged tables** — exactly what the user entered or what an import
  produced, unmodified: `DailyMetrics`, `Workout`, `FoodEntry`, `SymptomEntry`,
  `MenstrualCycleEntry`, `SkinEntry`, etc.
- **Derived tables** — anything computed from raw data: `Cycle` (phase estimates),
  `DerivedMetric` (e.g. volleyball active-calorie model output), `WeeklyReport`,
  `Insight`. Every row in a derived table carries:
  ```ts
  interface DerivedMetric<T> {
    value: T;
    rangeLow?: T;
    rangeHigh?: T;
    confidence: "exploratory" | "low" | "moderate" | "high";
    sources: string[];        // which raw tables/fields fed this
    algorithmVersion: string; // so re-running an old algorithm's output is traceable
    computedAt: string;
  }
  ```
  Recomputing a derived table never mutates raw data, and is always safe to
  re-run from scratch (derived tables are a cache of domain-layer function output, not
  a second source of truth).

## 7. Privacy boundaries

- Default: **zero network calls**. Every Phase 1/2 feature (nutrition parsing,
  volleyball modeling, cycle analysis, insights) runs entirely against on-device data
  with on-device heuristics.
- The *only* code path that can leave the device is an opt-in AI nutrition/inbox
  parser (Phase 3+, explicitly gated in Settings, off by default). Its input type
  structurally excludes cycle/symptom/skin data — it only ever receives the raw text
  the user typed into that one field.
- No analytics, crash reporting, or ad SDKs anywhere in the dependency tree.
- Photos (skin tracker) are stored as IndexedDB blobs, never uploaded anywhere.

## 8. Decisions that are expensive to reverse later

1. **Dexie/IndexedDB, not SQLite-via-WASM.** Reversing this means a full data-export/
   reimport migration. Mitigated the same way as health-tracker: every table is
   behind a repository; nothing outside `src/storage` issues a Dexie query directly.
2. **Cycle phase estimation is confidence-labeled from day one**, never a bare date.
   Every place a phase is shown or used as an analysis input carries its confidence
   tier alongside it — retrofitting this later would mean touching every call site.
3. **Client-generated stable IDs (UUIDs)** for every entity, for the same
   export/import/future-sync reasons as health-tracker.
4. **Strong integration is CSV-import-based**, isolated behind `WorkoutSourceAdapter`,
   because there is no public stable Strong API as of this writing (documented
   research finding — reconfirm if Strong ships one later; swapping in a real API
   adapter later only touches this one adapter, not the workout domain model).
5. **The insights engine's confidence thresholds (cycles/sessions -> label) are a
   named, single source of truth** (`src/domain/insights/confidenceThresholds.ts`),
   not duplicated per feature, so the brief's "never overstate sparse data" rule is
   enforced in exactly one place.

## 9. Directory layout (Phase 1)

```
health-insights/
  ARCHITECTURE.md
  DATA_MODEL.md
  IMPLEMENTATION_PLAN.md
  README.md
  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.ts
  index.html
  src/
    domain/
      models/                 # entity + DerivedMetric types
      nutrition/               # activity-adjusted targets, calibration
      weight/                  # rolling average, trend slope, cycle-day comparison
      training/                 # load aggregation
      cycle/                    # phase estimation, confidence
      insights/                 # observation/correlation/hypothesis/recommendation
    storage/
      db.ts                    # Dexie schema + migrations
      schemas/                 # Zod schemas per entity
      repositories/
    integrations/
      health/                  # HealthDataAdapter + Apple export / Shortcuts / manual
      workouts/                # WorkoutSourceAdapter + Strong CSV / manual
      nutrition/                # NL food parser (heuristic MVP), AI parser stub (Phase 3+)
    app/
      seedData.ts
      AppProviders.tsx
      services/                 # composition services bridging domain + storage
    ui/
      screens/                 # Today, Nutrition, Training, Cycle, Trends, Inbox
      components/
      charts/
      theme/
    main.tsx
    App.tsx
```

## 10. Major technical limitations (stated up front, per brief)

- **No live Apple Health access.** See §2/§9 (IMPLEMENTATION_PLAN.md) for the three
  supported ingestion paths and their tradeoffs.
- **No public stable Strong API.** CSV export import only, for now.
- **Volleyball/active-calorie estimates are personal-model estimates, not ground
  truth** — always shown as a range with a confidence label, never as a bare number
  presented with false precision.
- **Cycle phase without a directly-measured ovulation signal (BBT/LH) is an
  estimate**, confidence-labeled per the brief's tiers, and downgraded further when
  cycles are irregular or hormonal contraception is in use.
- **The insights engine intentionally refuses to produce "high confidence" output
  below its sample-size thresholds** — this is a feature, not a gap, but it does mean
  Phase 1 (no history yet) will show mostly "exploratory" or no insights at all until
  a few weeks of data accumulate.
- **This app does not diagnose.** See DATA_MODEL.md/IMPLEMENTATION_PLAN.md for the
  exact safety-language constraints carried through the insights engine and symptom/
  return-to-run modules.
