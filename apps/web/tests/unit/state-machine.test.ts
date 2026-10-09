import { describe, expect, it } from "vitest";
import { canTransition, assertTransition, InvalidTransitionError, isTerminal } from "../../lib/state-machine";

describe("state machine", () => {
  it("allows the documented happy path", () => {
    const path = [
      "consented",
      "context",
      "discovery",
      "confirmation",
      "eligibility_check",
      "baseline_frozen",
      "crux",
      "pre_evidence_recorded",
      "assigned",
      "pending_review",
      "approved",
      "delivered",
      "ack_recorded",
      "measured",
      "followup_due",
      "complete",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it("allows parking from discovery, eligibility_check, and crux", () => {
    expect(canTransition("discovery", "parked")).toBe(true);
    expect(canTransition("eligibility_check", "parked")).toBe(true);
    expect(canTransition("crux", "parked")).toBe(true);
  });

  it("allows refusal only from pending_review", () => {
    expect(canTransition("pending_review", "refused")).toBe(true);
    expect(canTransition("approved", "refused")).toBe(false);
  });

  it("allows an actionable return to 'assigned' from pending_review (Tier 2 item 8: inaccurate brief or unresolved evidence relation is not a terminal refusal)", () => {
    expect(canTransition("pending_review", "assigned")).toBe(true);
    // Still not allowed from anywhere else — this is specifically the
    // review-revision loop, not a general backwards escape hatch.
    expect(canTransition("approved", "assigned")).toBe(false);
    expect(canTransition("refused", "assigned")).toBe(false);
  });

  it("allows automatic delivery to skip straight from assigned/pending_review/approved to delivered or parked (removing the mandatory human-review dependency)", () => {
    expect(canTransition("assigned", "delivered")).toBe(true);
    expect(canTransition("assigned", "parked")).toBe(true);
    expect(canTransition("pending_review", "delivered")).toBe(true);
    expect(canTransition("pending_review", "parked")).toBe(true);
    expect(canTransition("approved", "delivered")).toBe(true); // pre-existing, unchanged
    expect(canTransition("approved", "parked")).toBe(true);
    // Still not reachable from unrelated states.
    expect(canTransition("crux", "delivered")).toBe(false);
    expect(canTransition("refused", "delivered")).toBe(false);
  });

  it("rejects skipping ahead", () => {
    expect(canTransition("consented", "delivered")).toBe(false);
    expect(canTransition("discovery", "baseline_frozen")).toBe(false);
  });

  it("rejects leaving a terminal state", () => {
    expect(canTransition("parked", "discovery")).toBe(false);
    expect(canTransition("complete", "measured")).toBe(false);
  });

  it("allows withdrawal from any non-terminal state", () => {
    expect(canTransition("discovery", "withdrawn")).toBe(true);
    expect(canTransition("crux", "withdrawn")).toBe(true);
    expect(canTransition("pending_review", "withdrawn")).toBe(true);
  });

  it("rejects withdrawal from an already-terminal state", () => {
    expect(canTransition("parked", "withdrawn")).toBe(false);
    expect(canTransition("complete", "withdrawn")).toBe(false);
  });

  it("assertTransition throws InvalidTransitionError on an illegal hop", () => {
    expect(() => assertTransition("discovery", "delivered")).toThrow(InvalidTransitionError);
  });

  it("isTerminal matches the documented terminal set", () => {
    expect(isTerminal("parked")).toBe(true);
    expect(isTerminal("refused")).toBe(true);
    expect(isTerminal("withdrawn")).toBe(true);
    expect(isTerminal("complete")).toBe(true);
    expect(isTerminal("discovery")).toBe(false);
  });
});
