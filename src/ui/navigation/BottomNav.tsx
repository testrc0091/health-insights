import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", label: "Today", icon: "🏠" },
  { to: "/nutrition", label: "Nutrition", icon: "🍽️" },
  { to: "/training", label: "Training", icon: "🏋️" },
  { to: "/cycle", label: "Cycle", icon: "🌙" },
  { to: "/trends", label: "Trends", icon: "📈" },
  { to: "/inbox", label: "Inbox", icon: "✍️" },
];

/** Six top-level tabs, matching IMPLEMENTATION_PLAN.md's screen map. Settings,
 * body measurements, symptoms, skin, and return-to-run are reachable FROM these tabs
 * (Today/Training/Cycle each link out) rather than added as a 7th+ bottom-nav item,
 * to keep navigation depth limited. */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-surface/95 backdrop-blur dark:border-slate-800 dark:bg-surface-dark/95">
      <div
        className="mx-auto flex max-w-md justify-between px-2 py-1"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px] font-medium ${
                isActive ? "text-accent" : "text-slate-400 dark:text-slate-500"
              }`
            }
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
