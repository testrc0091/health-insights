import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { subDays } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "../components/Card";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import { PageHeader } from "../components/PageHeader";
import { toIsoDate } from "../../domain/dateUtils";
import { rollingAverage, type DailyWeight } from "../../domain/weight/trend";
import { confidenceQualifier } from "../../domain/insights/confidenceThresholds";
import { computeInsights } from "../../app/services/insightsService";
import { generateWeeklyReport } from "../../app/services/weeklyReportService";
import { dailyMetricsRepository, weeklyReportRepository } from "../../storage/repositories";
import type { DraftInsight } from "../../domain/insights/engine";
import type { InsightDomain } from "../../domain/insights/types";
import type { WeeklyReport } from "../../storage/schemas/derived";

const TRENDS_HISTORY_DAYS = 60;

const DOMAIN_LABEL: Record<InsightDomain, string> = {
  nutrition: "Nutrition",
  training: "Training",
  recovery: "Recovery",
  cycle: "Cycle",
  skin: "Skin",
  symptoms: "Symptoms",
  mood: "Mood",
};

function InsightCard({ insight }: { insight: DraftInsight & { id?: string } }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {DOMAIN_LABEL[insight.domain]}
        </span>
        <ConfidenceBadge tier={insight.confidence} />
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-200">{insight.text}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">{confidenceQualifier(insight.confidence)}</p>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}

function WeeklyReportSummary({ report }: { report: WeeklyReport }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Nutrition
        </h3>
        <div className="flex flex-col gap-1">
          <StatRow label="Avg calories" value={Math.round(report.nutritionSummary.avgCalories).toString()} />
          <StatRow label="Avg protein" value={`${Math.round(report.nutritionSummary.avgProteinG)} g`} />
          <StatRow label="Avg fiber" value={`${Math.round(report.nutritionSummary.avgFiberG)} g`} />
          <StatRow label="Avg carbs" value={`${Math.round(report.nutritionSummary.avgCarbsG)} g`} />
          <StatRow
            label="Target adherence"
            value={`${Math.round(report.nutritionSummary.targetAdherencePct)}%`}
          />
        </div>
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Training
        </h3>
        <div className="flex flex-col gap-1">
          <StatRow label="Lifting sessions" value={report.trainingSummary.liftingSessions.toString()} />
          <StatRow label="Volleyball minutes" value={report.trainingSummary.volleyballMinutes.toString()} />
          <StatRow label="Avg steps" value={Math.round(report.trainingSummary.avgSteps).toLocaleString()} />
          <StatRow
            label="Training load score"
            value={Math.round(report.trainingSummary.trainingLoadScore).toString()}
          />
        </div>
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Weight
        </h3>
        <div className="flex flex-col gap-1">
          <StatRow label="7-day average" value={`${report.weightSummary.sevenDayAvg.toFixed(1)} lb`} />
          <StatRow
            label="Trend"
            value={`${report.weightSummary.trendSlopePerWeek >= 0 ? "+" : ""}${report.weightSummary.trendSlopePerWeek.toFixed(1)} lb/wk`}
          />
        </div>
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Recovery
        </h3>
        <div className="flex flex-col gap-1">
          <StatRow
            label="Avg sleep"
            value={`${Math.floor(report.recoverySummary.avgSleepMinutes / 60)}h ${Math.round(
              report.recoverySummary.avgSleepMinutes % 60,
            )}m`}
          />
          <StatRow
            label="Avg resting heart rate"
            value={report.recoverySummary.avgRestingHeartRate != null ? `${Math.round(report.recoverySummary.avgRestingHeartRate)} bpm` : "—"}
          />
          <StatRow
            label="Avg soreness"
            value={report.recoverySummary.avgSoreness != null ? `${report.recoverySummary.avgSoreness.toFixed(1)}/5` : "—"}
          />
          <StatRow
            label="Avg energy"
            value={report.recoverySummary.avgEnergy != null ? `${report.recoverySummary.avgEnergy.toFixed(1)}/5` : "—"}
          />
        </div>
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Cycle
        </h3>
        <div className="flex flex-col gap-1">
          <StatRow label="Cycle day" value={report.cycleSummary.cycleDay != null ? report.cycleSummary.cycleDay.toString() : "—"} />
          <StatRow label="Status" value={report.cycleSummary.periodStatus ?? "—"} />
        </div>
        {report.cycleSummary.notablePatterns.length > 0 && (
          <ul className="mt-1 list-inside list-disc text-sm text-slate-600 dark:text-slate-300">
            {report.cycleSummary.notablePatterns.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Skin
        </h3>
        <StatRow label="Acne trend" value={report.skinSummary.acneTrend.replace("_", " ")} />
      </div>
      {report.topRecommendations.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Top recommendations
          </h3>
          <div className="flex flex-col gap-2">
            {report.topRecommendations.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Cross-domain view: recovery/training trends over the last ~60 days, the Personal
 * Insights Engine's output, and the weekly report generator + browsable history of
 * past reports. Nutrition-vs-target charts live on the Nutrition screen — this screen
 * intentionally sticks to what's cheaply derivable from dailyMetrics plus the
 * app-service-computed insights/report, rather than re-deriving nutrition totals. */
export function TrendsScreen() {
  const today = toIsoDate(new Date());

  const recentMetrics = useLiveQuery(async () => {
    const startDate = toIsoDate(subDays(new Date(), TRENDS_HISTORY_DAYS));
    const all = await dailyMetricsRepository.getAll();
    return all.filter((m) => m.date >= startDate && m.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  }, [today]);

  const weightSeries = useMemo(() => {
    if (!recentMetrics) return undefined;
    const weights: DailyWeight[] = recentMetrics
      .filter((m) => m.weightLb != null)
      .map((m) => ({ date: m.date, weightLb: m.weightLb as number }));
    const rolling = rollingAverage(weights, 7);
    const rollingByDate = new Map(rolling.map((r) => [r.date, r.average]));
    return weights.map((w) => ({ date: w.date, raw: w.weightLb, rollingAvg: rollingByDate.get(w.date) ?? null }));
  }, [recentMetrics]);

  const stepsSeries = useMemo(
    () => recentMetrics?.filter((m) => m.steps != null).map((m) => ({ date: m.date, steps: m.steps as number })),
    [recentMetrics],
  );
  const sleepSeries = useMemo(
    () =>
      recentMetrics
        ?.filter((m) => m.sleepDurationMinutes != null)
        .map((m) => ({ date: m.date, sleepHours: (m.sleepDurationMinutes as number) / 60 })),
    [recentMetrics],
  );
  const rhrSeries = useMemo(
    () =>
      recentMetrics
        ?.filter((m) => m.restingHeartRate != null)
        .map((m) => ({ date: m.date, rhr: m.restingHeartRate as number })),
    [recentMetrics],
  );
  const sorenessEnergySeries = useMemo(
    () =>
      recentMetrics
        ?.filter((m) => m.soreness != null || m.perceivedEnergy != null)
        .map((m) => ({ date: m.date, soreness: m.soreness, energy: m.perceivedEnergy })),
    [recentMetrics],
  );

  const insights = useLiveQuery(() => computeInsights(), []);

  const pastReports = useLiveQuery(async () => {
    const all = await weeklyReportRepository.getAll();
    return [...all].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  }, []);

  const [latestReport, setLatestReport] = useState<WeeklyReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  async function handleGenerateReport() {
    setIsGenerating(true);
    try {
      const report = await generateWeeklyReport();
      setLatestReport(report);
      setExpandedReportId(report.id);
    } finally {
      setIsGenerating(false);
    }
  }

  const insightsByDomain = useMemo(() => {
    if (!insights) return new Map<InsightDomain, DraftInsight[]>();
    const grouped = new Map<InsightDomain, DraftInsight[]>();
    for (const insight of insights) {
      const list = grouped.get(insight.domain) ?? [];
      list.push(insight);
      grouped.set(insight.domain, list);
    }
    return grouped;
  }, [insights]);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="Trends" subtitle="Cross-domain patterns from your last two months of tracking" />

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Weight (60 days)</h2>
        {weightSeries === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : weightSeries.length < 2 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Log weight on a few more days to see a trend.</p>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" hide />
                <YAxis domain={["auto", "auto"]} width={36} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="raw" name="Daily" stroke="#cbd5e1" dot={false} strokeWidth={1} />
                <Line
                  type="monotone"
                  dataKey="rollingAvg"
                  name="7-day avg"
                  stroke="#ec4899"
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Steps</h2>
        {stepsSeries === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : stepsSeries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No step data logged yet.</p>
        ) : (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stepsSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" hide />
                <YAxis width={36} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="steps" fill="#ec4899" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Sleep (hours)</h2>
        {sleepSeries === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : sleepSeries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No sleep data logged yet.</p>
        ) : (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sleepSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" hide />
                <YAxis domain={["auto", "auto"]} width={30} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="sleepHours" stroke="#ec4899" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Resting heart rate</h2>
        {rhrSeries === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : rhrSeries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No resting heart rate data logged yet.</p>
        ) : (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rhrSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" hide />
                <YAxis domain={["auto", "auto"]} width={30} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="rhr" stroke="#ec4899" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Soreness &amp; energy (0-5)</h2>
        {sorenessEnergySeries === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : sorenessEnergySeries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No soreness/energy data logged yet.</p>
        ) : (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sorenessEnergySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" hide />
                <YAxis domain={[0, 5]} width={24} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="soreness" name="Soreness" stroke="#f59e0b" dot={false} strokeWidth={2} connectNulls />
                <Line type="monotone" dataKey="energy" name="Energy" stroke="#ec4899" dot={false} strokeWidth={2} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Personal insights</h2>
        {insights === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : insights.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Not enough tracked history yet for personal insights — keep logging and check back.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {Array.from(insightsByDomain.entries()).map(([domain, domainInsights]) => (
              <div key={domain} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-accent">{DOMAIN_LABEL[domain]}</h3>
                {domainInsights.map((insight, i) => (
                  <InsightCard key={i} insight={insight} />
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Weekly report</h2>
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {isGenerating ? "Generating…" : "Generate this week's report"}
          </button>
        </div>

        {latestReport && (
          <div className="mb-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <p className="mb-2 text-xs font-medium text-slate-400 dark:text-slate-500">
              Week of {latestReport.weekStartDate}
            </p>
            <WeeklyReportSummary report={latestReport} />
          </div>
        )}

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Past reports
        </h3>
        {pastReports === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : pastReports.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No reports generated yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pastReports.map((report) => (
              <div key={report.id}>
                <button
                  type="button"
                  onClick={() => setExpandedReportId(expandedReportId === report.id ? null : report.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                >
                  <span className="text-slate-700 dark:text-slate-200">Week of {report.weekStartDate}</span>
                  <span className="text-accent">{expandedReportId === report.id ? "Hide" : "View"}</span>
                </button>
                {expandedReportId === report.id && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                    <WeeklyReportSummary report={report} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
