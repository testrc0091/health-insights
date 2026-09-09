import { v4 as uuid } from "uuid";
import { cycleRepository, getUserProfileOrDefault, menstrualCycleEntryRepository } from "../../storage/repositories";
import { estimateCycleWindow, phaseForDate, type CyclePhaseName } from "../../domain/cycle/phaseEstimation";
import { estimatePhaseConfidence } from "../../domain/cycle/phaseConfidence";
import { parseIsoDate } from "../../domain/dateUtils";
import type { Cycle } from "../../storage/schemas/cycle";

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Groups raw MenstrualCycleEntry rows into cycles (split on `periodStart` markers),
 * computes each cycle's estimated ovulation/phase windows + confidence tier, and
 * replaces the `cycles` derived table with the result. Always safe to re-run from
 * scratch — derived tables are a recomputable cache, never a second source of truth
 * (ARCHITECTURE.md §6). Call after any menstrual-log write.
 */
export async function recomputeCycles(): Promise<Cycle[]> {
  const entries = (await menstrualCycleEntryRepository.getAll()).sort((a, b) => a.date.localeCompare(b.date));
  const profile = await getUserProfileOrDefault();
  await cycleRepository.clear();

  const periodStarts = entries.filter((e) => e.periodStart).map((e) => e.date);
  if (periodStarts.length === 0) return [];

  const cycleLengths: number[] = [];
  for (let i = 1; i < periodStarts.length; i++) {
    const days = Math.round(
      (parseIsoDate(periodStarts[i]!).getTime() - parseIsoDate(periodStarts[i - 1]!).getTime()) / 86_400_000,
    );
    cycleLengths.push(days);
  }
  const averageCycleLengthDays = cycleLengths.length > 0 ? Math.round(average(cycleLengths)) : 28;
  const isRegular = cycleLengths.length >= 2 && Math.max(...cycleLengths) - Math.min(...cycleLengths) <= 5;

  const cycles: Cycle[] = periodStarts.map((startDate, i) => {
    const endDate = i + 1 < periodStarts.length ? periodStarts[i + 1]! : null;
    const entriesThisCycle = entries.filter((e) => e.date >= startDate && (endDate == null || e.date < endDate));
    const periodLengthDays = entriesThisCycle.filter((e) => e.bleeding !== "none").length || 5;

    const window = estimateCycleWindow({
      periodStartDate: startDate,
      periodLengthDays,
      averageCycleLengthDays,
      averageLutealLengthDays: 14,
    });

    const confidence = estimatePhaseConfidence({
      hasPeriodStartLoggedThisCycle: true,
      ovulationSignal: {
        bbtShiftDetected: false,
        positiveLhTest: entriesThisCycle.some((e) => e.ovulationTestResult === "positive"),
        explicitOvulationMarker: false,
      },
      cycleHistory: { cyclesLogged: periodStarts.length, isRegular },
      usingHormonalContraception: profile.contraception.hormonal,
    });

    return {
      id: uuid(),
      startDate,
      endDate,
      cycleLengthDays: endDate ? (cycleLengths[i] ?? null) : null,
      periodLengthDays,
      estimatedOvulationDate: {
        name: "estimatedOvulationDate",
        value: window.estimatedOvulationDate,
        confidence,
        sources: ["menstrualCycleEntries"],
        algorithmVersion: "phase-estimation.v1",
        computedAt: new Date().toISOString(),
      },
      follicularPhaseRange: window.follicularRange,
      lutealPhaseRange: window.lutealRange,
      phaseConfidence: confidence,
      isRegular: periodStarts.length >= 3 ? isRegular : null,
      algorithmVersion: "phase-estimation.v1",
    };
  });

  await cycleRepository.bulkPut(cycles);
  return cycles;
}

/** Which named cycle phase a date falls in, given already-computed `cycles` rows —
 * returns null when the date falls outside every known cycle rather than guessing. */
export function phaseNameForDateInCycles(date: string, cycles: Cycle[]): CyclePhaseName | null {
  const cycle = cycles.find((c) => date >= c.startDate && (c.endDate == null || date < c.endDate));
  if (!cycle) return null;

  const window = {
    estimatedOvulationDate: cycle.estimatedOvulationDate?.value ?? cycle.startDate,
    follicularRange: cycle.follicularPhaseRange ?? { start: cycle.startDate, end: cycle.startDate },
    lutealRange: cycle.lutealPhaseRange ?? { start: cycle.startDate, end: cycle.startDate },
  };
  return phaseForDate(date, cycle.startDate, cycle.periodLengthDays ?? 5, window);
}
