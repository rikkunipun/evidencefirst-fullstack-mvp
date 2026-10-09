import { z } from "zod";

/**
 * Structured-output contract from `docs/handoff/AI_Adaptive_Interviewer_Contract_V3.md`.
 * Field names are snake_case because this exact shape is sent to the model
 * via `zodTextFormat` and becomes the JSON schema the model must fill in.
 */
export const PROMPT_VERSION = "v2";

export const FIELD_NAMES = [
  "chosen_action",
  "rejected_alternative",
  "expected_outcome",
  "origin_of_expectation",
  "actual_consequence",
  "consequence_evidence",
] as const;
export type FieldName = (typeof FIELD_NAMES)[number];

const extractionSchema = z.object({
  chosen_action: z.string().nullable(),
  rejected_alternative: z.string().nullable(),
  expected_outcome: z.string().nullable(),
  origin_of_expectation: z.string().nullable(),
  actual_consequence: z.string().nullable(),
  consequence_evidence: z.string().nullable(),
});

const fieldEvidenceSchema = z.object({
  chosen_action: z.array(z.string()),
  rejected_alternative: z.array(z.string()),
  expected_outcome: z.array(z.string()),
  origin_of_expectation: z.array(z.string()),
  actual_consequence: z.array(z.string()),
  consequence_evidence: z.array(z.string()),
});

export const candidateDriverSchema = z.enum([
  "outcome_belief",
  "social_influence",
  "practical_barrier",
  "preference_value",
  "behavior_gap",
  "unclear",
  // Added v2: a story mentions enjoyment/preference AND an outcome
  // expectation, and it isn't yet clear which one actually drove the
  // choice. Backward compatible — an additive enum value, old rows using
  // any prior value still parse. See MIXED_DRIVER_QUESTION.
  "mixed_uncertain",
]);

export const stopReasonSchema = z
  .enum(["candidate_ready", "question_budget_exhausted", "unsafe_or_excluded", "no_stable_candidate"])
  .nullable();

export const safetySchema = z.enum(["in_scope", "human_review", "stop"]);

export const discoveryTurnSchema = z.object({
  next_question: z
    .string()
    .nullable()
    .refine((q) => q === null || q.trim().split(/\s+/).length <= 25, {
      message: "next_question must be at most 25 words",
    }),
  extraction: extractionSchema,
  field_evidence: fieldEvidenceSchema,
  next_missing_field: z.enum(FIELD_NAMES).nullable(),
  candidate_driver: candidateDriverSchema,
  needs_participant_confirmation: z.boolean(),
  should_stop: z.boolean(),
  stop_reason: stopReasonSchema,
  safety: safetySchema,
});

export type DiscoveryTurn = z.infer<typeof discoveryTurnSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
