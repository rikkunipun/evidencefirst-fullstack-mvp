# Repair session rules (2026-10-09 final build)

Re-read this file after any context compaction during this repair session.

## Time
- Hard stop: 6:00 PM IST, 2026-10-09. Pilots start 7:00 PM. Submission cutoff midnight.
- A stable deployed build matters more than completeness.
- Commit after each item.
- Report at 4:00 PM and 5:30 PM IST: what's done, what's deferred, current commit hash.

## Hard constraints
- Do not deploy until the user explicitly replies "deploy" to a summary.
- Do not touch production data, rotate passwords, or delete records.
- Do not run production migrations other than the authorized is_test marking,
  and only after the user explicitly says "run the marking".
- Do not switch the OpenAI model.
- Diagnose first, before writing fixes — confirm root cause, don't assume it.

## Order
- Tier 1 (must ship) before Tier 2.
- Tier 2 only after Tier 1 is done and verified.
- Tier 3 is deferred — record in docs/deferred.md, don't implement.

## Non-negotiable product guardrails
- A topic with common misconceptions does not mean this participant is wrong.
- Never suggest a false belief, invent a past cost, manufacture eligibility,
  or optimize questions to lower scores.
- Never treat a technical extraction failure as evidence of a preference.
- Never bypass provenance, consent, evidence scope, deterministic gates, or
  researcher approval.
- Supported, unchanged, and increased scores are all valid results.
- Keep credentials, researcher-only fields, raw extraction diagnostics, and
  unreleased drafts server-side only.
- Preserve: the six deterministic gates, the two-pass crux limit, the frozen
  baseline, fixed/personalized assignment, researcher approval, and the exact
  delivery receipt.

## Confirmed root cause (2026-10-09, live-model repro)
`enforceProvenance` (lib/ai/discovery-pure.ts) requires each field_evidence
entry to be an exact match against a valid participant message ID. Live
repro on the reviewer's failing case showed the model reliably returns
citations like `"<uuid>: \"<quoted snippet>\""` rather than a bare UUID.
The exact-match check rejects these, nulling fields that were actually
correctly and honestly cited. Combined with `STOP_REASON_MESSAGES.candidate_ready
=== ""` and `??` not catching empty string, this produced the blank,
unexplained park. Fix = tolerant ID-extraction in provenance matching +
tightened prompt citation format, not a loosening of provenance itself
(a cited message still must be real and in the valid set).
