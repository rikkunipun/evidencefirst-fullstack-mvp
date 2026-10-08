/**
 * Central session state machine. Every API route must call `assertTransition`
 * inside the same DB transaction as its mutation. No UI infers state; every
 * page renders exactly what `sessions.state` says.
 */
export const SESSION_STATES = [
  "consented",
  "context",
  "discovery",
  "confirmation",
  "eligibility_check",
  "parked",
  "baseline_frozen",
  "crux",
  "pre_evidence_recorded",
  "assigned",
  "pending_review",
  "refused",
  "approved",
  "delivered",
  "ack_recorded",
  "measured",
  "followup_due",
  "complete",
  "withdrawn",
] as const;

export type SessionState = (typeof SESSION_STATES)[number];

export const TERMINAL_STATES: ReadonlySet<SessionState> = new Set([
  "parked",
  "refused",
  "withdrawn",
  "complete",
]);

/** Allowed forward transitions. Withdrawal is allowed from any non-terminal state (checked separately). */
const TRANSITIONS: Record<SessionState, SessionState[]> = {
  consented: ["context"],
  context: ["discovery"],
  discovery: ["confirmation", "parked"],
  confirmation: ["eligibility_check", "discovery"],
  eligibility_check: ["baseline_frozen", "parked"],
  parked: [],
  baseline_frozen: ["crux"],
  crux: ["pre_evidence_recorded", "parked"],
  pre_evidence_recorded: ["assigned"],
  assigned: ["pending_review"],
  pending_review: ["approved", "refused"],
  refused: [],
  approved: ["delivered"],
  delivered: ["ack_recorded"],
  ack_recorded: ["measured"],
  measured: ["followup_due"],
  followup_due: ["complete"],
  complete: [],
  withdrawn: [],
};

export class InvalidTransitionError extends Error {
  constructor(from: SessionState, to: SessionState) {
    super(`Invalid session transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(from: SessionState, to: SessionState): boolean {
  if (to === "withdrawn") return !TERMINAL_STATES.has(from);
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: SessionState, to: SessionState): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export function isTerminal(state: SessionState): boolean {
  return TERMINAL_STATES.has(state);
}
