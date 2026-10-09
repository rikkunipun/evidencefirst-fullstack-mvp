/**
 * Pure helper factored out of claim-classifier.ts so it's unit-testable
 * without pulling in "server-only"/the OpenAI client. No network, no env.
 */
import type { PackPolicy } from "../pack-policy";

/** Server-side validation (item 3): the model's raw classification must be
 * exactly one of the pack's real kind ids, or exactly "none"/"unclear" —
 * anything else (a hallucinated id, extra text, a different pack's kind
 * id) is treated as "unclear", never force-matched to the closest-looking
 * real kind. */
export function validateClassification(raw: string, policy: PackPolicy): string | "none" | "unclear" {
  const trimmed = raw.trim();
  if (trimmed === "none" || trimmed === "unclear") return trimmed;
  const match = policy.allowedKinds.find((k) => k.id === trimmed);
  return match ? match.id : "unclear";
}

/** The one bounded, neutral clarification question (item 3) — fixed and
 * generic across every pack/case on purpose: it must never hint at which
 * category the model is weighing, or imply the participant's claim is
 * wrong. Asked at most once per session. */
export const CLAIM_KIND_CLARIFICATION_QUESTION = "Can you restate the specific thing you expect, as precisely as possible?";
