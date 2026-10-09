/**
 * Pure routing decision for the auto-deliver pipeline (item 3/4), factored
 * out of the route so it's unit-testable without the DB/model/HTTP.
 */
import type { PackPolicy, EvidenceRelation } from "./pack-policy";

export type AutoDeliveryDecision = { outcome: "deliver"; evidenceRelation: EvidenceRelation } | { outcome: "park" };

/**
 * A validated classification of "none", a classification that doesn't
 * resolve to a real kind in the pack's policy, or a kind whose declared
 * evidenceRelation is "unresolved" (none currently exist, but a future
 * policy edit must not silently start auto-delivering one) all park with
 * the fixed no-suitable-evidence reason — never force-matched, never
 * mislabeled as a preference, never queued for a human.
 */
export function decideAutoDeliveryOutcome(validatedKind: string, policy: PackPolicy | null): AutoDeliveryDecision {
  if (!policy || validatedKind === "none" || validatedKind === "unclear") return { outcome: "park" };
  const kindPolicy = policy.allowedKinds.find((k) => k.id === validatedKind);
  if (!kindPolicy || kindPolicy.evidenceRelation === "unresolved") return { outcome: "park" };
  return { outcome: "deliver", evidenceRelation: kindPolicy.evidenceRelation };
}
