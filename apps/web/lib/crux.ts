/**
 * Crux (reason-stability) loop. Pure decision logic over already-persisted
 * crux_passes rows; the route handler is responsible for persistence and the
 * one-neutral-question wording.
 */

export type CruxClassification =
  | "current_claim"
  | "near_term_test"
  | "distant_forecast"
  | "value_identity"
  | "unclear";

export interface CruxPassRecord {
  passNumber: 1 | 2;
  confirmedReason: string | null;
  hypotheticalScore: number | null;
}

export interface CruxDecisionInput {
  baselineScore: number;
  passes: CruxPassRecord[];
}

export type CruxDecision =
  | { action: "ask_next_pass"; passNumber: 1 | 2 }
  | { action: "stop"; carryingPass: CruxPassRecord | null };

/**
 * After a pass's hypothetical score is recorded: if confidence fell below
 * baseline, that reason "carries" the belief and we stop. Otherwise, allow
 * exactly one more participant-supplied reason, then stop regardless.
 */
export function decideNextCruxStep(input: CruxDecisionInput): CruxDecision {
  const { baselineScore, passes } = input;
  const last = passes[passes.length - 1];

  if (!last || last.hypotheticalScore === null) {
    throw new Error("decideNextCruxStep requires the latest pass to have a recorded hypothetical score");
  }

  const fellBelowBaseline = last.hypotheticalScore < baselineScore;
  if (fellBelowBaseline) {
    return { action: "stop", carryingPass: last };
  }

  if (passes.length >= 2) {
    // Two passes exhausted; neither reason carried the belief. Stop and
    // record zero change rather than pressuring a lower score.
    return { action: "stop", carryingPass: null };
  }

  return { action: "ask_next_pass", passNumber: 2 };
}

export function canProceedPastCrux(carryingPass: CruxPassRecord | null, classification: CruxClassification | null): boolean {
  if (!carryingPass || !carryingPass.confirmedReason) return false;
  if (classification === "current_claim" || classification === "near_term_test") return true;
  return false;
}
