import { z } from "zod";

/** Every external input is validated with one of these at the server boundary. */

export const SITUATION_CARDS = [
  "school",
  "college",
  "work",
  "job_search",
  "household",
  "business",
  "retirement",
  "other",
  "skip",
] as const;

/** Letters, digits, dash only, max 20 chars — e.g. ?pilot=sai-teja. No personal data. */
export const PILOT_LABEL_PATTERN = /^[A-Za-z0-9-]{1,20}$/;

export const createSessionSchema = z.object({
  // "v2" (item 8): added the automatic-evidence-selection/audit-afterwards
  // disclosure, replacing the old "a researcher may review" framing. "v1"
  // stays accepted for anything already pointed at the old copy.
  consentVersion: z.enum(["v1", "v2"]),
  situationCard: z.enum(SITUATION_CARDS),
  goal: z.string().trim().max(300).optional().nullable(),
  decisionCueId: z.string().trim().max(60).optional().nullable(),
  cardOrder: z.array(z.string()).max(12).optional(),
  freeText: z.string().trim().max(2000).optional().nullable(),
  pilotLabel: z.string().regex(PILOT_LABEL_PATTERN).optional().nullable(),
});

export const withdrawSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});

export const postMessageSchema = z.object({
  // null only on the very first call for a session, to kick off discovery
  // before the participant has answered anything.
  content: z.string().trim().min(1).max(2000).nullable(),
  inputMode: z.enum(["text", "voice"]).default("text"),
  // Client-generated per-attempt token so a retried submission (same
  // answer, resent after a timeout) can be recognized as a duplicate
  // instead of creating a second turn.
  clientToken: z.string().min(1).max(100).optional(),
});

export const eligibilityAnswersSchema = z.object({
  stillHoldsBelief: z.boolean(),
  scopeAndTime: z.string().trim().min(1).max(300),
  materiallyAffectedDecision: z.boolean(),
  consequenceOccurred: z.boolean(),
  consequenceEvidence: z.string().trim().max(500).optional().nullable(),
});

/**
 * Tier 2 item 7: the decision narrative and the current empirical claim
 * are confirmed as two separate fields, never one free-text blob — the
 * server composes the combined sentence (combineBeliefWording), it's
 * never accepted raw from the client.
 */
export const confirmBeliefSchema = z.object({
  decisionNarrative: z.string().trim().min(1).max(300),
  empiricalClaim: z.string().trim().min(1).max(300),
});

export const baselineSchema = z.object({
  baselineScore: z.number().int().min(0).max(10),
});

export const cruxReasonSchema = z.object({
  action: z.literal("submit_reason"),
  stage: z.literal("reason"),
  reason: z.string().trim().min(1).max(500),
});

export const cruxConfirmSchema = z.object({
  action: z.literal("confirm_reason"),
  stage: z.literal("confirm"),
  confirmedReason: z.string().trim().min(1).max(500),
});

export const cruxHypotheticalSchema = z.object({
  action: z.literal("submit_hypothetical"),
  stage: z.literal("hypothetical"),
  hypotheticalScore: z.number().int().min(0).max(10),
});

export const cruxRequestSchema = z.discriminatedUnion("action", [cruxReasonSchema, cruxConfirmSchema, cruxHypotheticalSchema]);

export const measurementSchema = z.object({
  phase: z.enum(["pre_evidence", "post_evidence"]),
  score: z.number().int().min(0).max(10),
  explanation: z.string().trim().max(1000).optional().nullable(),
  reportedBehavior: z.string().trim().max(500).optional().nullable(),
});

export const followupSubmitSchema = z.object({
  score: z.number().int().min(0).max(10),
  reportedBehavior: z.string().trim().max(500),
  otherInfluences: z.string().trim().max(500).optional().nullable(),
});

/**
 * Tier 2 item 8: two separate, both-required questions — no default value
 * for either, so an omitted field fails validation rather than silently
 * defaulting to "Supported". briefAccurate asks whether the draft itself
 * is accurate and in scope; evidenceRelation asks how the evidence
 * actually relates to the participant's specific claim.
 */
export const adminApproveSchema = z.object({
  draftRevisionId: z.string().uuid(),
  briefAccurate: z.boolean(),
  evidenceRelation: z.enum(["supports", "qualifies", "contradicts", "unresolved", "outside_scope"]),
  scopeJustification: z.string().trim().min(1).max(1000),
  contentHash: z.string().min(1),
});

export const adminReversalSchema = z.object({
  packId: z.enum(["activity", "study", "learning"]).optional(),
  submittedClaim: z.string().trim().min(1).max(1000),
});

export const adminDraftSchema = z.object({
  // No body needed beyond the session id in the route; kept for future extension.
});

/**
 * General authorized path for marking sessions as synthetic/QA test data —
 * so a pilot label is never the only thing separating test fixtures from
 * real participant data. Exact session IDs only, no text/label matching.
 */
export const adminMarkTestSchema = z.object({
  sessionIds: z.array(z.string().uuid()).min(1).max(100),
  testRunId: z.string().trim().min(1).max(60),
  reason: z.string().trim().min(1).max(300),
});
