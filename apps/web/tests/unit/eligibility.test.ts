import { describe, expect, it } from "vitest";
import { evaluateEligibility, type EligibilityInput } from "../../lib/eligibility";

const fullPass: EligibilityInput = {
  hasConfirmedWording: true,
  stillHoldsBelief: true,
  chosenAction: "skipping the gym",
  rejectedAlternative: "going to the gym",
  expectedOutcome: "losing consistency",
  scopeAndTime: "general fitness, this month",
  materiallyAffectedDecision: true,
  consequenceOccurred: true,
  consequenceEvidence: "lifted 70% of normal weight afterward",
  checkableViaPackOrTest: true,
  withinSafeScope: true,
};

describe("evaluateEligibility", () => {
  it("passes all six gates and is eligible when every input is clean", () => {
    const result = evaluateEligibility(fullPass);
    expect(result.disposition).toBe("eligible");
    for (const gate of [result.current, result.specific, result.causal, result.consequential, result.checkable, result.safe]) {
      expect(gate.status).toBe("pass");
    }
  });

  it("fails current when the participant no longer holds the belief", () => {
    const result = evaluateEligibility({ ...fullPass, stillHoldsBelief: false });
    expect(result.current.status).toBe("fail");
    expect(result.disposition).toBe("parked");
  });

  it("marks current unknown before confirmation exists, and never passes on unknown", () => {
    const result = evaluateEligibility({ ...fullPass, hasConfirmedWording: false, stillHoldsBelief: null });
    expect(result.current.status).toBe("unknown");
    expect(result.disposition).toBe("parked");
  });

  it("fails specific when any of action/alternative/outcome/scope is missing", () => {
    const result = evaluateEligibility({ ...fullPass, scopeAndTime: "" });
    expect(result.specific.status).toBe("fail");
    expect(result.disposition).toBe("parked");
  });

  it("fails causal when the expectation did not materially affect the decision", () => {
    const result = evaluateEligibility({ ...fullPass, materiallyAffectedDecision: false });
    expect(result.causal.status).toBe("fail");
    expect(result.disposition).toBe("parked");
  });

  it("fails consequential when no actual cost has occurred", () => {
    const result = evaluateEligibility({ ...fullPass, consequenceOccurred: false });
    expect(result.consequential.status).toBe("fail");
    expect(result.disposition).toBe("parked");
  });

  it("marks consequential unknown when a cost is claimed but no evidence is given", () => {
    const result = evaluateEligibility({ ...fullPass, consequenceOccurred: true, consequenceEvidence: "" });
    expect(result.consequential.status).toBe("unknown");
    expect(result.disposition).toBe("parked");
  });

  it("fails checkable when no enabled pack or feasible test exists", () => {
    const result = evaluateEligibility({ ...fullPass, checkableViaPackOrTest: false });
    expect(result.checkable.status).toBe("fail");
    expect(result.disposition).toBe("parked");
  });

  it("fails safe when the case is outside scope", () => {
    const result = evaluateEligibility({ ...fullPass, withinSafeScope: false });
    expect(result.safe.status).toBe("fail");
    expect(result.disposition).toBe("parked");
  });

  it("treats unknown safety as not eligible (unknown never passes)", () => {
    const result = evaluateEligibility({ ...fullPass, withinSafeScope: null });
    expect(result.safe.status).toBe("unknown");
    expect(result.disposition).toBe("parked");
  });

  it("a single failed gate parks regardless of how many gates pass", () => {
    const result = evaluateEligibility({ ...fullPass, consequenceOccurred: false, checkableViaPackOrTest: false });
    expect(result.current.status).toBe("pass");
    expect(result.disposition).toBe("parked");
  });
});
