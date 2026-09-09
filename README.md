# Health Insights

A local-first health-tracking Progressive Web App: nutrition (with sugar/caffeine
tracking), strength + volleyball training, weight & body measurements, menstrual
cycle, symptoms, skin/acne, an "AI Health Inbox" for quick multi-domain logging, and a
personal insights engine that looks for real patterns across all of it — with
confidence levels attached, never overstated.

Everything lives in your browser's IndexedDB. There is no account, no server, and no
data ever leaves your device by default.

## Install it on your iPhone

1. Open the deployed site (see **Deploying to GitHub Pages** below) in Safari on your
   iPhone.
2. Tap the Share icon, then **Add to Home Screen**.
3. Launch it from the home screen icon like any other app. It works offline after the
   first load.

## Running it locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open the printed `localhost` URL. Other useful scripts:

```bash
npm run build      # production build to dist/
npm run preview    # serve the production build locally
npm test           # run the domain-layer test suite (Vitest)
npm run typecheck  # TypeScript, no emit
npm run lint       # ESLint
```

## Deploying to GitHub Pages

This repo already includes `.github/workflows/deploy.yml`, which builds, tests, and
deploys to GitHub Pages automatically on every push to `main`.

1. Create a new GitHub repository and push this project to it.
2. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` (or re-run the workflow from the **Actions** tab). The site will be
   published at `https://<your-username>.github.io/<repo-name>/`.
4. If you name the repo something other than `health-insights`, update the
   `VITE_BASE_PATH` value in `.github/workflows/deploy.yml` and the fallback in
   `vite.config.ts` to match — GitHub Pages serves a project site under `/<repo-name>/`,
   and every asset URL needs that prefix.

## Getting your data in

**Apple Health** (Settings → Health → Settings → Export All Health Data): unzip the
result and select the `export.xml` file in this app's Settings screen. This is a
one-time/periodic manual import, not a live sync — Safari can't read HealthKit
directly, so this is the supported path for a PWA. Re-importing the same or an
overlapping export is safe; workouts are deduplicated and daily metrics are merged,
not duplicated.

**Strong** (the strength-training app): export a CSV from Strong and import it from
the Training or Settings screen. Strong has no public API as of this writing, so CSV
is the supported path.

**Backup/restore**: Settings → Export Backup downloads a full JSON snapshot of your
data; Import Backup restores from one. This is also how you'd move data between two
devices, since nothing syncs automatically.

## What this app deliberately does not do

- **No AI or network calls.** Natural-language food logging and the "AI Health Inbox"
  use a small on-device, rule-based parser — not an LLM. It's genuinely useful for
  common foods and phrasing, but it will visibly under-parse unusual ones (shown as a
  low-confidence, wide-range estimate rather than a fabricated precise number) and
  it's not going to match arbitrary phrasing as well as an LLM would. This was a
  deliberate choice (no API key to manage, nothing ever leaves your device).
- **No live Apple Health access.** See above — manual export import only.
- **No camera barcode scanning.** Barcode lookup is a small manual-entry starter list;
  scanning would require an added camera/scanning library.
- **No cross-device sync.** Data lives in this browser's IndexedDB on this device.
  Use the JSON backup/restore to move data between devices — there's no server to sync
  through.
- **Personal insights need a few weeks of real data.** The insights engine explicitly
  refuses to show a confident pattern from too little history — an empty or
  "exploratory only" Trends screen for the first couple of weeks is expected, not a
  bug.
- **Nothing here is medical advice or a diagnosis.** Symptom/return-to-run "flags" are
  configurable nudges to consider a clinical check-in, never a diagnosis.
- Very large Apple Health exports (many years of Apple Watch history) can take several
  seconds to parse, since parsing happens entirely in the browser.

## Project structure

See `ARCHITECTURE.md`, `DATA_MODEL.md`, and `IMPLEMENTATION_PLAN.md` for the full
design. In short:

```
src/domain/        pure calculation logic, unit-tested, zero I/O
src/storage/        Dexie/IndexedDB schema, Zod validation, repositories
src/integrations/    Apple Health/Strong/food-database parsers (no network)
src/app/             composition layer wiring storage+domain into React
src/ui/              screens and shared components
```

## Tech stack

React + TypeScript + Vite, Tailwind, Dexie (IndexedDB), Zod, Recharts, date-fns,
react-router-dom, vite-plugin-pwa, Vitest.
