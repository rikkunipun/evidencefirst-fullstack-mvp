/**
 * Maps the new, explicit two-question review (Tier 2 item 8) onto the
 * legacy `disposition` column for anything still reading it (admin
 * display, exports) — never used for routing logic, which reads
 * briefAccurate/evidenceRelation directly. Pulled out as its own,
 * unit-tested function after a real bug: "supports" (the new enum's verb
 * form) was passed straight through, but the legacy check constraint
 * only accepts "supported" (adjective) — a silent mismatch that only
 * surfaced as a 500 from the DB's check constraint at approval time.
 */
export function legacyDisposition(briefAccurate: boolean, evidenceRelation: string): string {
  if (!briefAccurate) return "needs_clarification";
  if (evidenceRelation === "unresolved") return "needs_clarification";
  if (evidenceRelation === "outside_scope") return "outside_scope";
  if (evidenceRelation === "supports") return "supported";
  return evidenceRelation; // qualifies|contradicts
}

/** Every value this function can return must be accepted by the DB's
 * approvals_disposition_check constraint (migration 0016). Keep this in
 * sync by hand — there's no way to introspect the live constraint from
 * here — and let the unit test enumerate every input combination instead
 * of trusting a live DB round trip to catch a mismatch. */
export const LEGACY_DISPOSITION_ALLOWED_VALUES = ["supported", "qualifies", "unsupported", "needs_clarification", "contradicts", "outside_scope"] as const;
