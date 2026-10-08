/**
 * Deterministic six-gate eligibility engine. The model proposes extraction;
 * this module decides pass/fail/unknown. `unknown` never passes. A high
 * confidence score cannot compensate for a failed or unknown gate.
 */

export const RULES_VERSION = "eligibility-v1";

export type GateStatus = "pass" | "fail" | "unknown";

export interface EligibilityInput {
  /** Confirmed read-back wording exists and participant explicitly confirmed it. */
  hasConfirmedWording: boolean;
  /** Participant explicitly reaffirmed they still hold this expectation today. */
  stillHoldsBelief: boolean | null;
  /** Action, alternative, expected outcome all non-empty strings. */
  chosenAction: string | null;
  rejectedAlternative: string | null;
  expectedOutcome: string | null;
  /** Scope/time qualifier established (e.g. "for general health", "this semester"). */
  scopeAndTime: string | null;
  /** Participant confirmed the expectation materially affected the decision (not merely present). */
  materiallyAffectedDecision: boolean | null;
  /** An actual (not hypothetical/future) money, time, or health cost already occurred. */
  consequenceOccurred: boolean | null;
  consequenceEvidence: string | null;
  /** An enabled evidence pack exists for this topic, or a feasible personal test is describable. */
  checkableViaPackOrTest: boolean | null;
  /** Case is not political/identity persuasion, crisis, addiction treatment, or individualized medical/legal/financial advice. */
  withinSafeScope: boolean | null;
}

export interface GateResult {
  status: GateStatus;
  reason: string;
}

export interface EligibilityResult {
  current: GateResult;
  specific: GateResult;
  causal: GateResult;
  consequential: GateResult;
  checkable: GateResult;
  safe: GateResult;
  disposition: "eligible" | "parked";
  rulesVersion: string;
}

function boolGate(value: boolean | null, passReason: string, failReason: string, unknownReason: string): GateResult {
  if (value === true) return { status: "pass", reason: passReason };
  if (value === false) return { status: "fail", reason: failReason };
  return { status: "unknown", reason: unknownReason };
}

export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const current = input.hasConfirmedWording
    ? boolGate(
        input.stillHoldsBelief,
        "You confirmed you still expect this today.",
        "You told us this is no longer what you expect, so there is nothing current to test.",
        "We don't yet know whether this is still what you expect today.",
      )
    : { status: "unknown" as const, reason: "The belief statement has not been confirmed yet." };

  const hasAllSpecificFields = Boolean(
    input.chosenAction?.trim() && input.rejectedAlternative?.trim() && input.expectedOutcome?.trim() && input.scopeAndTime?.trim(),
  );
  const specific: GateResult = hasAllSpecificFields
    ? { status: "pass", reason: "Action, alternative, expected outcome, and scope/time are all recorded." }
    : { status: "fail", reason: "One or more of action, alternative, expected outcome, or scope/time is missing." };

  const causal = boolGate(
    input.materiallyAffectedDecision,
    "The expectation materially affected the decision.",
    "The decision happened for a different reason, so this expectation did not drive it.",
    "We don't yet know whether this expectation actually drove the decision.",
  );

  const consequential =
    input.consequenceOccurred === true && !input.consequenceEvidence?.trim()
      ? { status: "unknown" as const, reason: "An actual cost was reported, but no supporting detail was given." }
      : boolGate(
          input.consequenceOccurred,
          "An actual past cost (money, time, or health) has already occurred and is supported.",
          "No actual cost has happened yet, so there is nothing to evaluate against evidence.",
          "We don't yet know whether an actual cost has occurred.",
        );

  const checkable = boolGate(
    input.checkableViaPackOrTest,
    "Credible evidence or a feasible personal test can address this claim.",
    "No credible evidence or feasible personal test can address this exact claim.",
    "We don't yet know whether this claim is checkable.",
  );

  const safe = boolGate(
    input.withinSafeScope,
    "This case is within the study's safety and scope boundaries.",
    "This case falls outside the study's safety and scope boundaries.",
    "We don't yet know whether this case is within scope.",
  );

  const gates = [current, specific, causal, consequential, checkable, safe];
  const disposition = gates.every((g) => g.status === "pass") ? "eligible" : "parked";

  return { current, specific, causal, consequential, checkable, safe, disposition, rulesVersion: RULES_VERSION };
}
