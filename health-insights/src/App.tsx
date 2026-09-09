/**
 * Placeholder shell so the build/test/deploy pipeline is green from the first push.
 * The domain layer (nutrition/weight/cycle/training/insights) is fully built and
 * tested — see src/domain/. Storage, integrations, and the real six-tab UI (Today /
 * Nutrition / Training / Cycle / Trends / Inbox) are still being built; each will
 * replace this placeholder incrementally, and every push keeps deploying to the same
 * URL via GitHub Pages.
 */
const TABS = ["Today", "Nutrition", "Training", "Cycle", "Trends", "Inbox"] as const;

export function App() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
        <span className="text-3xl">🩺</span>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Health Insights</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Local-first nutrition, training, and cycle insights. The core calculation
          engine is built and tested — the six-tab app UI is under active
          construction.
        </p>
      </div>
      <ul className="grid w-full grid-cols-3 gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        {TABS.map((tab) => (
          <li key={tab} className="rounded-lg border border-slate-200 py-3 dark:border-slate-800">
            {tab}
          </li>
        ))}
      </ul>
    </div>
  );
}
