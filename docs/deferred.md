# Deferred work (2026-10-09 final-build repair)

Explicitly out of scope for today's deadline per the task's own tiering.
Nothing here was started. Listed so it isn't silently dropped.

## Tier 3 (deferred by the task's own instruction)
- Multi-session resume (a participant returning to an old session after
  losing their cookie/link has no recovery path beyond the one follow-up
  link flow).
- Persistent (cross-request/cross-instance) spend limits — current rate
  limiting (`lib/rate-limit.ts`) is in-memory/per-instance, documented as
  such, not distributed-grade.
- Full race-test matrix (concurrent withdrawal vs. approval vs. delivery
  vs. measurement writes) — Tier 2 item 11 below covers the single most
  important case only (if even reached).
- Full mobile layout/viewport test matrix.
- Real-model smoke tests beyond the small, clearly-labelled samples in
  `scripts/real-model-smoke-test.ts` and `scripts/latency-benchmark.ts`.

## Tier 2 items not reached today (see handoff doc for exact status)
Tier 1 (items 1–6) was completed first, per instruction. Tier 2 items 7–11
— empirical-claim/decision separation, researcher supports/qualifies/
contradicts/unresolved/outside-scope review, free-text topic proposal +
confirmation, follow-up link recovery after refresh, and transactional
consent/approval/delivery/measurement writes — were not started today;
see the handoff document for exact status at the 6pm stop.

## Noted but not built today (lower-risk gaps surfaced during Tier 1 work)
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
