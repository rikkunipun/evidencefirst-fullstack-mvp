import type { SessionState } from "@/lib/state-machine";

const STAGE_FOR_STATE: Record<SessionState, string> = {
  consented: "Tell us what happened",
  context: "Tell us what happened",
  discovery: "Tell us what happened",
  confirmation: "Check our understanding",
  eligibility_check: "Check our understanding",
  parked: "Your result",
  baseline_frozen: "Your belief and reasons",
  crux: "Your belief and reasons",
  pre_evidence_recorded: "Your belief and reasons",
  assigned: "Review in progress",
  pending_review: "Review in progress",
  refused: "Your result",
  approved: "Review in progress",
  delivered: "Information for you",
  ack_recorded: "Share your response",
  measured: "Your receipt",
  followup_due: "Your receipt",
  complete: "Your receipt",
  withdrawn: "Your result",
};

export function ProgressLabel({ state }: { state: SessionState }) {
  return <p className="text-xs font-medium uppercase tracking-wide text-[var(--ef-muted)]">{STAGE_FOR_STATE[state]}</p>;
}
