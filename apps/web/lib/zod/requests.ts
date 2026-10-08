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

export const createSessionSchema = z.object({
  consentVersion: z.literal("v1"),
  situationCard: z.enum(SITUATION_CARDS),
  goal: z.string().trim().max(300).optional().nullable(),
  decisionCueId: z.string().trim().max(60).optional().nullable(),
  cardOrder: z.array(z.string()).max(12).optional(),
  freeText: z.string().trim().max(2000).optional().nullable(),
});

export const withdrawSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});

export const postMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  inputMode: z.enum(["text", "voice"]).default("text"),
});

export const confirmBeliefSchema = z.object({
  confirmedWording: z.string().trim().min(1).max(500),
  stillHoldsBelief: z.boolean(),
  scopeAndTime: z.string().trim().min(1).max(300),
  materiallyAffectedDecision: z.boolean(),
  consequenceOccurred: z.boolean(),
  consequenceEvidence: z.string().trim().max(500).optional().nullable(),
  withinSafeScope: z.boolean().optional(), // server may also derive this from topic
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

export const cruxClassifySchema = z.object({
  action: z.literal("classify"),
  stage: z.literal("classify"),
  classification: z.enum(["current_claim", "near_term_test", "distant_forecast", "value_identity", "unclear"]),
});

export const cruxRequestSchema = z.discriminatedUnion("action", [
  cruxReasonSchema,
  cruxConfirmSchema,
  cruxHypotheticalSchema,
  cruxClassifySchema,
]);

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

export const adminApproveSchema = z.object({
  draftRevisionId: z.string().uuid(),
  disposition: z.enum(["supported", "qualifies", "unsupported", "needs_clarification"]),
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
