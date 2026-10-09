import type { FieldMap } from "./extraction-merge";

/**
 * Protocol Stage 4 read-back. Tier 2 item 7 split this into two separately
 * confirmable parts — a read-back of the past decision, and the current,
 * testable empirical claim — instead of one free-text sentence the
 * participant could edit as an undifferentiated blob. `combineBeliefWording`
 * is the one place that joins them, so the combined sentence used by every
 * existing downstream reader (eligibility, baseline, crux, delivery,
 * receipts, exports) stays byte-identical to the pre-split wording.
 */
export function generateDecisionNarrative(fields: FieldMap): string {
  return `I chose ${fields.chosen_action} instead of ${fields.rejected_alternative}`;
}

export function generateEmpiricalClaim(fields: FieldMap): string {
  return `I expected ${fields.expected_outcome}.`;
}

export function combineBeliefWording(decisionNarrative: string, empiricalClaim: string): string {
  return `${decisionNarrative} because ${empiricalClaim}`;
}

export function generateBeliefWording(fields: FieldMap): string {
  return combineBeliefWording(generateDecisionNarrative(fields), generateEmpiricalClaim(fields));
}
