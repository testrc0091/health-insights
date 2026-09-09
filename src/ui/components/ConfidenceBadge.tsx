import type { ConfidenceTier } from "../../domain/models/common";

const LABEL: Record<ConfidenceTier, string> = {
  exploratory: "Exploratory",
  low: "Low confidence",
  moderate: "Moderate confidence",
  high: "High confidence",
};

const STYLE: Record<ConfidenceTier, string> = {
  exploratory: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  moderate: "bg-accent-muted/40 text-accent dark:text-accent-muted",
  high: "bg-accent text-white",
};

/** Every derived number in this app carries a confidence tier (ARCHITECTURE.md §8.2)
 * — this badge is the one place that tier gets rendered, so its wording/styling never
 * drifts between screens. */
export function ConfidenceBadge({ tier }: { tier: ConfidenceTier }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLE[tier]}`}>{LABEL[tier]}</span>;
}
