import type { SessionState } from "../state-machine";

/** Client-safe copy of the snapshot shape (no "server-only" import chain). */
export interface SessionSnapshot {
  session: { id: string; state: SessionState; revision: number; packTopic: string | null; createdAt: string; withdrawnAt: string | null; parkReason?: string | null };
  context: { situationCard: string; goal: string | null; decisionCue: string | null; freeText: string | null } | null;
  messages: { id: string; turnNumber: number; role: string; content: string; createdAt: string }[];
  latestExtraction: { fields: Record<string, string | null>; candidateDriver: string; shouldStop: boolean; stopReason: string | null } | null;
  questionsAsked: number;
  beliefConfirmation: { id: string; revision: number; generatedWording: string; confirmedWording: string | null; confirmedAt: string | null } | null;
  eligibility: { current: string; specific: string; causal: string; consequential: string; checkable: string; safe: string; disposition: string; reasons: Record<string, string> } | null;
  baseline: { beliefWording: string; scopeAndTime: string; baselineScore: number; frozenAt: string } | null;
  cruxPasses: { passNumber: number; statedReason: string; confirmedReason: string | null; hypotheticalScore: number | null }[];
  cruxClassification: string | null;
  measurements: { phase: string; score: number; explanation: string | null; recordedAt: string }[];
  assignment: { condition: "fixed" | "personalized"; packId: string; packVersion: string } | null;
  draft: { id: string; claimOrder: string[]; renderedText: string; wordCount: number; contentHash: string } | null;
  approval: { disposition: string; approvedAt: string } | null;
  delivery: { exactText: string; claimIds: string[]; deliveredAt: string; displayedAckAt: string | null } | null;
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
