import { addDays, differenceInCalendarDays } from "date-fns";
import { parseIsoDate, toIsoDate } from "../dateUtils";
import type { CyclePhaseConfidence, ISODate } from "../models/common";

export type CyclePhaseName = "menstrual" | "follicular" | "ovulatory" | "luteal";

export interface PhaseEstimationInput {
  periodStartDate: ISODate;
  periodLengthDays: number;
  /** Typical full cycle length from history, or a population-average default (28)
   * when there isn't enough personal history yet — always paired with a confidence
   * tier by the caller so a default-driven estimate never reads as certain. */
  averageCycleLengthDays: number;
  /** Typical luteal-phase length from history, or the population-average default
   * (14) — ovulation date is derived by subtracting this from cycle length, the
   * standard method used when no direct ovulation signal is available. */
  averageLutealLengthDays: number;
}

export interface EstimatedCycleWindow {
  estimatedOvulationDate: ISODate;
  follicularRange: { start: ISODate; end: ISODate };
  lutealRange: { start: ISODate; end: ISODate };
}

const DEFAULT_CYCLE_LENGTH_DAYS = 28;
const DEFAULT_LUTEAL_LENGTH_DAYS = 14;

export function estimateCycleWindow(input: PhaseEstimationInput): EstimatedCycleWindow {
  const cycleLength = input.averageCycleLengthDays || DEFAULT_CYCLE_LENGTH_DAYS;
  const lutealLength = input.averageLutealLengthDays || DEFAULT_LUTEAL_LENGTH_DAYS;
  const periodStart = parseIsoDate(input.periodStartDate);

  const ovulationDate = addDays(periodStart, cycleLength - lutealLength);
  const cycleEnd = addDays(periodStart, cycleLength - 1);
  const follicularEnd = addDays(ovulationDate, -1);

  return {
    estimatedOvulationDate: toIsoDate(ovulationDate),
    follicularRange: { start: input.periodStartDate, end: toIsoDate(follicularEnd) },
    lutealRange: { start: toIsoDate(ovulationDate), end: toIsoDate(cycleEnd) },
  };
}

/** Which named phase a given date falls into, given the estimated window. Callers
 * always pair this with the window's confidence tier (see phaseConfidence.ts) before
 * showing it to the user — this function itself makes no confidence judgment. */
export function phaseForDate(
  date: ISODate,
  periodStartDate: ISODate,
  periodLengthDays: number,
  window: EstimatedCycleWindow,
): CyclePhaseName {
  const cycleDay = cycleDayForDate(date, periodStartDate);
  if (cycleDay <= periodLengthDays) return "menstrual";

  const ovulationDay = cycleDayForDate(window.estimatedOvulationDate, periodStartDate);
  if (Math.abs(cycleDay - ovulationDay) <= 1) return "ovulatory";
  if (cycleDay < ovulationDay) return "follicular";
  return "luteal";
}

export function cycleDayForDate(date: ISODate, periodStartDate: ISODate): number {
  return differenceInCalendarDays(parseIsoDate(date), parseIsoDate(periodStartDate)) + 1;
}

/** Formats a phase estimate for display, always carrying its confidence tier
 * alongside the label — brief's explicit requirement that phase never appears as a
 * bare, unqualified fact (ARCHITECTURE.md §8.2). */
export function describePhase(phase: CyclePhaseName, confidence: CyclePhaseConfidence): string {
  const label = phase[0]!.toUpperCase() + phase.slice(1);
  return confidence === "high" ? label : `Estimated ${label.toLowerCase()} (${confidence} confidence)`;
}
