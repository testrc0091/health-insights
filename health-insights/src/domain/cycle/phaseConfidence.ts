import type { CyclePhaseConfidence } from "../models/common";

export interface OvulationSignal {
  bbtShiftDetected: boolean;
  positiveLhTest: boolean;
  explicitOvulationMarker: boolean;
}

export interface CycleHistorySummary {
  cyclesLogged: number;
  /** Low variance in cycle length across logged history. */
  isRegular: boolean;
}

export interface PhaseConfidenceInput {
  hasPeriodStartLoggedThisCycle: boolean;
  ovulationSignal: OvulationSignal;
  cycleHistory: CycleHistorySummary;
  usingHormonalContraception: boolean;
}

const REGULAR_HISTORY_MIN_CYCLES = 3;

/**
 * Implements the brief's exact confidence tiers (DATA_MODEL.md "Cycle"):
 * - high: logged period start + a direct ovulation indicator this cycle.
 * - medium: regular cycle history (>= 3 cycles), no direct signal this cycle —
 *   ovulation is inferred from typical luteal length.
 * - low: irregular/sparse history, or hormonal contraception in use (brief: never
 *   apply natural-cycle phase assumptions without qualification under contraception).
 */
export function estimatePhaseConfidence(input: PhaseConfidenceInput): CyclePhaseConfidence {
  if (input.usingHormonalContraception) return "low";

  const hasDirectOvulationSignal =
    input.ovulationSignal.bbtShiftDetected ||
    input.ovulationSignal.positiveLhTest ||
    input.ovulationSignal.explicitOvulationMarker;

  if (input.hasPeriodStartLoggedThisCycle && hasDirectOvulationSignal) return "high";

  if (input.cycleHistory.cyclesLogged >= REGULAR_HISTORY_MIN_CYCLES && input.cycleHistory.isRegular) {
    return "medium";
  }

  return "low";
}
