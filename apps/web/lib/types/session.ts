import type { SessionState } from "../state-machine";

/** Client-safe copy of the snapshot shape (no "server-only" import chain). */
export interface SessionSnapshot {
  session: {
    id: string;
    state: SessionState;
    revision: number;
    packTopic: string | null;
    createdAt: string;
    withdrawnAt: string | null;
    parkReason?: string | null;
    /** Set only when a bounded repair for a validation failure also failed.
     * Distinct from parkReason — state stays 'discovery'. Participant-safe
     * (fixed, pre-approved wording; no transcript or diagnostics). */
    discoveryRecoveryReason?: string | null;
    /** Not sensitive (a researcher-chosen short label, no personal data) —
     * surfaced so "Try a different decision" can carry it into the next
     * session's /participate link instead of silently dropping it. */
    pilotLabel?: string | null;
    /** The one bounded, neutral clarification question (item 3), set only
     * while state is assigned/pending_review/approved and the automatic
     * classifier needs it. Fixed, generic text — participant-safe. */
    claimKindClarificationQuestion?: string | null;
  };
  /** Live value of DELIVERY_MODE (item 7) — governs which participant view
   * renders for assigned/pending_review/approved, not a per-session DB
   * field (sessions.delivery_mode is a separate, write-once audit
   * snapshot of what was active at creation time). */
  deliveryMode: "auto" | "manual";
  context: { situationCard: string; goal: string | null; decisionCue: string | null; freeText: string | null } | null;
  messages: { id: string; turnNumber: number; role: string; content: string; createdAt: string }[];
  latestExtraction: { fields: Record<string, string | null>; candidateDriver: string; shouldStop: boolean; stopReason: string | null } | null;
  questionsAsked: number;
  beliefConfirmation: {
    id: string;
    revision: number;
    generatedWording: string;
    confirmedWording: string | null;
    confirmedAt: string | null;
    /** Tier 2 item 7 split — null for a row created before the split
     * migration (an in-flight session at deploy time); the UI falls back
     * to the single combined field in that case. */
    generatedDecisionNarrative: string | null;
    generatedEmpiricalClaim: string | null;
    confirmedDecisionNarrative: string | null;
    confirmedEmpiricalClaim: string | null;
  } | null;
  eligibility: { current: string; specific: string; causal: string; consequential: string; checkable: string; safe: string; disposition: string; reasons: Record<string, string> } | null;
  baseline: { beliefWording: string; scopeAndTime: string; baselineScore: number; frozenAt: string } | null;
  cruxPasses: { passNumber: number; statedReason: string; confirmedReason: string | null; hypotheticalScore: number | null }[];
  cruxClassification: string | null;
  measurements: { phase: string; score: number; explanation: string | null; recordedAt: string }[];
  assignment: { condition: "fixed" | "personalized"; packId: string; packVersion: string } | null;
  draft: { id: string; claimOrder: string[]; renderedText: string; wordCount: number; contentHash: string } | null;
  approval: { disposition: string; approvedAt: string } | null;
  delivery: {
    exactText: string;
    exactHtml: string;
    claimIds: string[];
    sourceMap: { claimId: string; sourceTitle: string; url: string; locator: string }[];
    deliveredAt: string;
    displayedAckAt: string | null;
  } | null;
  followup: { dueAt: string; collectedAt: string | null } | null;
}

/**
 * What a participant's own API responses and page props may contain.
 * Deliberately omits fields that are internal to the experiment/research
 * process and must never reach the participant before (or regardless of)
 * delivery: experimental condition/assignment, draft text, and reviewer
 * disposition. `delivery` itself is safe to keep as-is — that row only
 * exists in the database after a researcher has approved it, so there is
 * no pre-approval leak path through it.
 */
export type ParticipantSessionSnapshot = Omit<SessionSnapshot, "assignment" | "draft" | "approval" | "latestExtraction">;
