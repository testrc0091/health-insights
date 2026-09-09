import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-card border border-slate-200 bg-surface p-4 shadow-sm dark:border-slate-800 dark:bg-surface-dark ${className}`}
    >
      {children}
    </div>
  );
}
