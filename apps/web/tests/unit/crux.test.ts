import { describe, expect, it } from "vitest";
import { decideNextCruxStep, canProceedPastCrux } from "../../lib/crux";

describe("decideNextCruxStep", () => {
  it("stops and carries the first pass when its hypothetical score falls below baseline", () => {
    const decision = decideNextCruxStep({
      baselineScore: 9,
      passes: [{ passNumber: 1, confirmedReason: "no gym equipment", hypotheticalScore: 4 }],
    });
    expect(decision.action).toBe("stop");
    if (decision.action === "stop") expect(decision.carryingPass?.passNumber).toBe(1);
  });

  it("asks for a second pass when the first does not fall below baseline", () => {
    const decision = decideNextCruxStep({
      baselineScore: 9,
      passes: [{ passNumber: 1, confirmedReason: "no gym equipment", hypotheticalScore: 9 }],
    });
    expect(decision).toEqual({ action: "ask_next_pass", passNumber: 2 });
  });

  it("stops with no carrying pass after two passes neither of which fell below baseline", () => {
    const decision = decideNextCruxStep({
      baselineScore: 9,
      passes: [
        { passNumber: 1, confirmedReason: "reason A", hypotheticalScore: 9 },
        { passNumber: 2, confirmedReason: "reason B", hypotheticalScore: 10 },
      ],
    });
    expect(decision.action).toBe("stop");
    if (decision.action === "stop") expect(decision.carryingPass).toBeNull();
  });

  it("never asks for a third pass even if the cap were accidentally exceeded upstream", () => {
    const decision = decideNextCruxStep({
      baselineScore: 9,
      passes: [
        { passNumber: 1, confirmedReason: "reason A", hypotheticalScore: 9 },
        { passNumber: 2, confirmedReason: "reason B", hypotheticalScore: 9 },
      ],
    });
    expect(decision.action).toBe("stop");
  });

  it("throws if asked to decide before the latest pass has a hypothetical score", () => {
    expect(() =>
      decideNextCruxStep({ baselineScore: 9, passes: [{ passNumber: 1, confirmedReason: "x", hypotheticalScore: null }] }),
    ).toThrow();
  });
});

describe("canProceedPastCrux", () => {
  it("proceeds only for current_claim or near_term_test with a confirmed carrying pass", () => {
    const pass = { passNumber: 1 as const, confirmedReason: "x", hypotheticalScore: 4 };
    expect(canProceedPastCrux(pass, "current_claim")).toBe(true);
    expect(canProceedPastCrux(pass, "near_term_test")).toBe(true);
    expect(canProceedPastCrux(pass, "distant_forecast")).toBe(false);
    expect(canProceedPastCrux(pass, "value_identity")).toBe(false);
    expect(canProceedPastCrux(pass, "unclear")).toBe(false);
  });

  it("never proceeds without a carrying pass, regardless of classification", () => {
    expect(canProceedPastCrux(null, "current_claim")).toBe(false);
  });

  it("never proceeds if the carrying pass lacks a confirmed reason", () => {
    const pass = { passNumber: 1 as const, confirmedReason: null, hypotheticalScore: 4 };
    expect(canProceedPastCrux(pass, "current_claim")).toBe(false);
  });
});
