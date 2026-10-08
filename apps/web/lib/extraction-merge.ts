import { FIELD_NAMES, type FieldName } from "./zod/discovery";

export type FieldMap = Record<FieldName, string | null>;

export const EMPTY_FIELDS: FieldMap = {
  chosen_action: null,
  rejected_alternative: null,
  expected_outcome: null,
  origin_of_expectation: null,
  actual_consequence: null,
  consequence_evidence: null,
};

/** Latest non-null value per field wins; a later null never erases a prior answer. */
export function mergeFields(history: FieldMap[]): FieldMap {
  const merged: FieldMap = { ...EMPTY_FIELDS };
  for (const turn of history) {
    for (const field of FIELD_NAMES) {
      if (turn[field] !== null && turn[field] !== undefined) merged[field] = turn[field];
    }
  }
  return merged;
}

export function firstMissingField(fields: FieldMap): FieldName | null {
  return FIELD_NAMES.find((f) => !fields[f]) ?? null;
}
