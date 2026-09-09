import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { addDays } from "date-fns";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useAppContext } from "../../app/AppProviders";
import { Card } from "../components/Card";
import { ProgressBar } from "../components/ProgressBar";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import { PageHeader } from "../components/PageHeader";
import { parseIsoDate, toIsoDate } from "../../domain/dateUtils";
import {
  dailyMetricsRepository,
  getDailyMetricsInRange,
  getMostRecentCycle,
  getWorkoutsInRange,
} from "../../storage/repositories";
import {
  getDailyIntakeTotalsInRange,
  getDailyNutritionTotals,
  getOrResolveNutritionTarget,
} from "../../app/services/nutritionService";
import { resolvePriorityToday, type NutrientProgress } from "../../domain/dashboard/priorityToday";
import { rollingAverage, type DailyWeight } from "../../domain/weight/trend";
import { cycleDayForDate, describePhase, phaseForDate } from "../../domain/cycle/phaseEstimation";
import { flagUnusualIntakeDays } from "../../domain/nutrition/sugarCaffeineBaseline";
import type { ActivityType, ConfidenceTier, CyclePhaseConfidence, DayOfWeek } from "../../domain/models/common";

const DAY_INDEX_TO_DOW: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const SUGAR_METRIC_LABEL: Record<"addedSugarG" | "totalSugarG" | "caffeineMg", string> = {
  addedSugarG: "Added sugar",
  totalSugarG: "Total sugar",
  caffeineMg: "Caffeine",
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function cycleConfidenceToTier(confidence: CyclePhaseConfidence): ConfidenceTier {
  if (confidence === "high") return "high";
  if (confidence === "medium") return "moderate";
  return "low";
}

/** App home dashboard: nutrition progress, today's priority, workouts, recovery,
 * cycle status, weight trend, and an unusual-intake note — all sourced live from
 * Dexie so any edit made elsewhere in the app (nutrition log, training schedule,
 * cycle log) is reflected here without a manual refresh. */
export function TodayScreen() {
  const { userProfile } = useAppContext();
  const today = toIsoDate(new Date());
  const todayLabel = parseIsoDate(today).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const totals = useLiveQuery(() => getDailyNutritionTotals(today), [today]);
  const target = useLiveQuery(() => getOrResolveNutritionTarget(today), [today]);

  const todayMetrics = useLiveQuery(async () => {
    const all = await dailyMetricsRepository.getAll();
    return all.find((m) => m.date === today) ?? null;
  }, [today]);

  const todaysWorkouts = useLiveQuery(() => {
    const dayStart = parseIsoDate(today);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    return getWorkoutsInRange(dayStart.toISOString(), dayEnd.toISOString());
  }, [today]);

  // Wrapped in an object so the useLiveQuery result is `undefined` only while the
  // query is in flight — otherwise "no cycle logged yet" (a legitimate resolved
  // value of `undefined`) would be indistinguishable from "still loading".
  const cycleResult = useLiveQuery(async () => ({ cycle: (await getMostRecentCycle()) ?? null }), []);
  const cycle = cycleResult?.cycle ?? null;

  const weightTrend = useLiveQuery(async () => {
    const startDate = toIsoDate(addDays(parseIsoDate(today), -13));
    const rows = await getDailyMetricsInRange(startDate, today);
    const weights: DailyWeight[] = rows
      .filter((r) => r.weightLb != null)
      .map((r) => ({ date: r.date, weightLb: r.weightLb as number }));
    return rollingAverage(weights, 7);
  }, [today]);

  const sugarHistory = useLiveQuery(() => {
    const endDate = toIsoDate(addDays(parseIsoDate(today), -1));
    const startDate = toIsoDate(addDays(parseIsoDate(today), -21));
    return getDailyIntakeTotalsInRange(startDate, endDate);
  }, [today]);

  const flaggedNote = useMemo(() => {
    if (!sugarHistory || !totals) return null;
    const flags = flagUnusualIntakeDays(sugarHistory, {
      date: today,
      addedSugarG: totals.addedSugarG,
      totalSugarG: totals.totalSugarG,
      caffeineMg: totals.caffeineMg,
    });
    const flagged = flags.find((f) => f.isUnusuallyHigh);
    if (!flagged) return null;
    const label = SUGAR_METRIC_LABEL[flagged.metric];
    return `${label} today is higher than your typical days — worth noting if sleep feels off tonight.`;
  }, [sugarHistory, totals, today]);

  const nutrients: NutrientProgress[] = useMemo(() => {
    if (!totals || !target) return [];
    const list: NutrientProgress[] = [
      { label: "calories", targetAmount: target.calorieTarget, consumedAmount: totals.calories },
      { label: "protein", targetAmount: target.proteinTargetG, consumedAmount: totals.proteinG },
      { label: "fiber", targetAmount: target.fiberTargetG, consumedAmount: totals.fiberG },
    ];
    if (target.carbTargetG != null) {
      list.push({ label: "carbs", targetAmount: target.carbTargetG, consumedAmount: totals.carbsG });
    }
    return list;
  }, [totals, target]);

  const activityType: ActivityType = useMemo(() => {
    const dow = DAY_INDEX_TO_DOW[new Date().getDay()]!;
    const plan = userProfile.trainingSchedule.find((p) => p.day === dow);
    return plan?.activityType ?? "other";
  }, [userProfile]);

  const priority = nutrients.length > 0 ? resolvePriorityToday({ nutrients, activityType }) : null;

  const cycleInfo = useMemo(() => {
    if (!cycle) return null;
    const window = {
      estimatedOvulationDate: cycle.estimatedOvulationDate?.value ?? cycle.startDate,
      follicularRange: cycle.follicularPhaseRange ?? { start: cycle.startDate, end: cycle.startDate },
      lutealRange: cycle.lutealPhaseRange ?? { start: cycle.startDate, end: cycle.startDate },
    };
    const phase = phaseForDate(today, cycle.startDate, cycle.periodLengthDays ?? 5, window);
    return {
      cycleDay: cycleDayForDate(today, cycle.startDate),
      description: describePhase(phase, cycle.phaseConfidence),
    };
  }, [cycle, today]);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title={greeting()} subtitle={todayLabel} />

      {priority && (
        <Card className="border-accent-muted/60 bg-accent-muted/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Priority today</p>
          <p className="mt-1 text-base font-medium text-slate-800 dark:text-slate-100">{priority.headline}</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Nutrition</h2>
        {totals && target ? (
          <div className="flex flex-col gap-3">
            <ProgressBar value={totals.calories} target={target.calorieTarget} label="Calories" unit="kcal" />
            <ProgressBar value={totals.proteinG} target={target.proteinTargetG} label="Protein" unit="g" />
            <ProgressBar value={totals.fiberG} target={target.fiberTargetG} label="Fiber" unit="g" />
            {target.carbTargetG != null && (
              <ProgressBar value={totals.carbsG} target={target.carbTargetG} label="Carbs" unit="g" />
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Today&apos;s workouts</h2>
        {todaysWorkouts === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : todaysWorkouts.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No workouts logged yet today.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {todaysWorkouts.map((w) => (
              <li key={w.id} className="flex items-center justify-between text-sm">
                <span className="capitalize text-slate-700 dark:text-slate-200">{w.workoutType}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {w.durationMinutes} min
                  {w.totalCaloriesKcal != null ? ` · ${Math.round(w.totalCaloriesKcal)} kcal` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Recovery snapshot</h2>
        {todayMetrics === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : !todayMetrics ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No recovery data logged yet today.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">Sleep</dt>
            <dd className="text-right text-slate-700 dark:text-slate-200">
              {todayMetrics.sleepDurationMinutes != null
                ? `${Math.floor(todayMetrics.sleepDurationMinutes / 60)}h ${todayMetrics.sleepDurationMinutes % 60}m`
                : "—"}
              {todayMetrics.sleepQuality != null ? ` (quality ${todayMetrics.sleepQuality}/5)` : ""}
            </dd>
            <dt className="text-slate-500 dark:text-slate-400">Resting heart rate</dt>
            <dd className="text-right text-slate-700 dark:text-slate-200">
              {todayMetrics.restingHeartRate != null ? `${todayMetrics.restingHeartRate} bpm` : "—"}
            </dd>
            <dt className="text-slate-500 dark:text-slate-400">Soreness</dt>
            <dd className="text-right text-slate-700 dark:text-slate-200">
              {todayMetrics.soreness != null ? `${todayMetrics.soreness}/5` : "—"}
            </dd>
            <dt className="text-slate-500 dark:text-slate-400">Perceived energy</dt>
            <dd className="text-right text-slate-700 dark:text-slate-200">
              {todayMetrics.perceivedEnergy != null ? `${todayMetrics.perceivedEnergy}/5` : "—"}
            </dd>
          </dl>
        )}
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cycle</h2>
          {cycle && <ConfidenceBadge tier={cycleConfidenceToTier(cycle.phaseConfidence)} />}
        </div>
        {cycleResult === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : cycle && cycleInfo ? (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Day {cycleInfo.cycleDay} · {cycleInfo.description}
          </p>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <Link to="/cycle" className="text-accent underline">
              Log your cycle
            </Link>{" "}
            to see phase info here.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Weight trend (14 days)</h2>
        {weightTrend === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : weightTrend.length < 2 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Log weight on a few more days to see a trend.</p>
        ) : (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" hide />
                <YAxis
                  width={36}
                  tick={{ fontSize: 10 }}
                  domain={["dataMin - 1", "dataMax + 1"] as [string, string]}
                />
                <Tooltip />
                <Line type="monotone" dataKey="average" stroke="#ec4899" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {flaggedNote && (
        <Card className="bg-slate-50 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-300">{flaggedNote}</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">More</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link to="/settings" className="text-accent underline">
            Settings
          </Link>
          <Link to="/body-measurements" className="text-accent underline">
            Body measurements
          </Link>
          <Link to="/symptoms" className="text-accent underline">
            Symptoms
          </Link>
          <Link to="/skin" className="text-accent underline">
            Skin
          </Link>
          <Link to="/return-to-run" className="text-accent underline">
            Return to run
          </Link>
        </div>
      </Card>
    </div>
  );
}
