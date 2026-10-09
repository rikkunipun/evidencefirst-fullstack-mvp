# Deferred work (2026-10-09 final-build repair)

Explicitly out of scope for today's deadline, or genuinely not reached.
Listed so it isn't silently dropped. Updated after Tier 2 items 7–11 were
implemented (all five now have real, tested work — see
`docs/handoff/2026-10-09-repair-handoff.md` for exact status per item).

## Tier 3 (deferred by the task's own instruction — not started)
- Multi-session resume (a participant returning to an old session after
  losing their cookie/link has no recovery path beyond the follow-up
  link reissue flow added for Tier 2 item 10, which only covers the
  post-measurement follow-up step, not the whole session).
- Persistent (cross-request/cross-instance) spend limits — current rate
  limiting (`lib/rate-limit.ts`) is in-memory/per-instance, documented as
  such, not distributed-grade.
- Full race-test matrix (every pairwise combination of concurrent
  withdrawal/approval/delivery/measurement writes, under load, across
  multiple instances) — Tier 2 item 11 closed the single most important
  case (withdrawal racing delivery/measurement) via a DB trigger, but a
  full matrix across every write path was not attempted.
- Full mobile layout/viewport test matrix.
- Real-model smoke tests beyond the small, clearly-labelled samples in
  `scripts/real-model-smoke-test.ts`, `scripts/latency-benchmark.ts`,
  `scripts/prod-verify.ts`, `scripts/topic-proposal-check.ts`, and
  `scripts/integration-check.ts`.

## Tier 2 — remaining scope within implemented items
Each item below has real, committed, tested work — this lists what's
specifically NOT covered within that item, not that the item is untouched.

- **Item 7** (decision/claim split): scope (`scope_and_time`) was already
  a separate field at the eligibility stage before today and wasn't
  touched. "All confidence scores use the same frozen claim" wasn't
  independently re-verified beyond confirming `confirmed_wording` is
  still read unchanged by baseline/crux/measurement — i.e., the
  plumbing wasn't rewired, only the confirmation step that feeds it.
- **Item 8** (researcher review split): the admin session detail page
  doesn't yet show the new `brief_accurate`/`evidence_relation` columns
  in the trace view (Section 3/9) — a researcher reviewing audit history
  would need to query them directly. The legacy `disposition` column is
  still derived/written for compatibility but its old semantic meaning
  for "unsupported" is now split across two new concepts; no data
  migration was run to backfill `brief_accurate`/`evidence_relation` for
  any pre-existing approval rows (none exist in production yet, per the
  reviewer's own retest — this app has no real delivered sessions).
- **Item 9** (free-text topic proposal): `proposeTopicKey` is a plain
  keyword heuristic over exactly three catalog topics, not a general
  classifier — a story that doesn't contain one of the matched keywords
  gets no proposal at all (falls through to the pre-existing "no
  checkable evidence" park), even if a human would recognize the topic.
  This is a deliberate, documented limitation (never force-match), not a
  bug, but it means recall is low by design.
- **Item 10** (follow-up link reissue): multi-session resume (losing the
  main session cookie, not just the follow-up link) is not covered — see
  Tier 3 above.
- **Item 11** (withdrawal atomicity): a full DB-transaction/RPC rewrite
  of the entire approve-and-deliver sequence (one atomic unit covering
  revision check + approval insert + delivery insert + state transition,
  not just the withdrawal check) was not attempted — the existing
  unique(deliveries.session_id) constraint plus revision-guarded
  `transitionSession` already prevents a true double-delivery from a
  concurrent double-click, and the new trigger closes the withdrawal gap
  specifically; a fully transactional rewrite of the whole sequence is
  the more complete fix but wasn't attempted under deadline pressure.
  `approvals` writes themselves are not withdrawal-gated (only
  `deliveries`/`measurements` are) — an approval record for a withdrawn
  session is low-harm (it's never shown to the participant) but could
  still be recorded; not fixed today.

## Noted but not built (lower-risk gaps surfaced during Tier 1 work)
- Validation diagnostics (`extraction_snapshots.validation_diagnostics`)
  are persisted and researcher-queryable directly in Supabase, but not
  yet surfaced in the admin session detail UI — only the list page shows
  the recovery/review-requested badges.
- Vercel function region vs. Supabase region (`ap-south-1`) was
  investigated, not changed — Next's per-route `preferredRegion` is
  deprecated and Vercel-side region pinning for Node serverless functions
  is a project/dashboard setting, not a code change. The latency
  benchmark suggests region is at most a minor contributor (the model's
  own inference time alone accounts for ~10s), so this wasn't prioritized
  under deadline pressure.
- A faster compatible model was not benchmarked in isolation (time did
  not allow); the production model was not changed.
