import { describe, expect, it } from "vitest";
import { estimatePhaseConfidence } from "./phaseConfidence";

const NO_SIGNAL = { bbtShiftDetected: false, positiveLhTest: false, explicitOvulationMarker: false };

describe("estimatePhaseConfidence", () => {
  it("is 'high' with a logged period start plus a direct ovulation signal", () => {
    const confidence = estimatePhaseConfidence({
      hasPeriodStartLoggedThisCycle: true,
      ovulationSignal: { ...NO_SIGNAL, positiveLhTest: true },
      cycleHistory: { cyclesLogged: 1, isRegular: false },
      usingHormonalContraception: false,
    });
    expect(confidence).toBe("high");
  });

  it("is 'medium' with regular history but no direct signal this cycle", () => {
    const confidence = estimatePhaseConfidence({
      hasPeriodStartLoggedThisCycle: true,
      ovulationSignal: NO_SIGNAL,
      cycleHistory: { cyclesLogged: 4, isRegular: true },
      usingHormonalContraception: false,
    });
    expect(confidence).toBe("medium");
  });

  it("is 'low' with sparse/irregular history and no direct signal", () => {
    const confidence = estimatePhaseConfidence({
      hasPeriodStartLoggedThisCycle: true,
      ovulationSignal: NO_SIGNAL,
      cycleHistory: { cyclesLogged: 1, isRegular: false },
      usingHormonalContraception: false,
    });
    expect(confidence).toBe("low");
  });

  it("is always 'low' under hormonal contraception, even with a direct signal and regular history", () => {
    const confidence = estimatePhaseConfidence({
      hasPeriodStartLoggedThisCycle: true,
      ovulationSignal: { ...NO_SIGNAL, bbtShiftDetected: true },
      cycleHistory: { cyclesLogged: 6, isRegular: true },
      usingHormonalContraception: true,
    });
    expect(confidence).toBe("low");
  });

  it("is 'low' when history is regular but below the 3-cycle minimum", () => {
    const confidence = estimatePhaseConfidence({
      hasPeriodStartLoggedThisCycle: true,
      ovulationSignal: NO_SIGNAL,
      cycleHistory: { cyclesLogged: 2, isRegular: true },
      usingHormonalContraception: false,
    });
    expect(confidence).toBe("low");
  });
});
