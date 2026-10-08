import type { FieldMap } from "./extraction-merge";

/** Protocol Stage 4 read-back template. The model never supplies this sentence directly. */
export function generateBeliefWording(fields: FieldMap): string {
  return `I chose ${fields.chosen_action} instead of ${fields.rejected_alternative} because I expected ${fields.expected_outcome}.`;
}
