# EvidenceFirst — submission evidence (2026-10-09)

Everything in this document is drawn from actual runs performed during
this repair/build session — real model calls, real Supabase database,
real Vercel production deployment. Nothing here is inferred, estimated,
or extrapolated beyond what a specific command, test, or request actually
produced. Mocked results and live-model results are labelled separately
throughout. **No claim in this document concerns persuasion efficacy or
belief change from a small pilot** — three (or even a dozen) participants
cannot establish that evidence delivery changes beliefs; that question is
explicitly out of scope for this evidence.

## Current state

- **Production:** `https://evidencefirst-fullstack-mvp.vercel.app`
- **Deployed commit:** `27762fc791d77ae2bff8f63704ab26ca733e5112` (branch `fullstack-mvp`)
- **Rollback checkpoint:** git tag `checkpoint-pre-auto` → `f0a6006` (the
  commit live before automatic delivery shipped). To roll back: re-promote
  the deployment at `https://evidencefirst-fullstack-8tlb0mlxo-rikkunipuns-projects.vercel.app`
  in Vercel, or set `DELIVERY_MODE=manual` and redeploy.
- **DELIVERY_MODE:** unset in the environment; defaults to `auto` in code.
- **Repository:** private GitHub repo, `https://github.com/rikkunipun/evidencefirst-fullstack-mvp`
  (branches `fullstack-mvp` and `auto-delivery` pushed; an older, unrelated
  local `main` branch was not force-pushed).

## What was fixed, in the order it was found

1. **Blank-park bug (confirmed root cause via live-model repro, not
   assumed):** the model cited `field_evidence` as `"<id>: \"<quote>\""`
   rather than a bare message ID; an exact-match provenance check nulled
   honestly-cited fields, and an empty-string park reason combined with a
   nullish-coalescing fallback produced a blank park screen for factual
   stories. Fixed with format-tolerant citation resolution (still rejects
   any citation with no real valid ID) and a corrected prompt.
2. **Mixed-driver preference misclassification, latency measurement,
   waiting-screen polling, in-flight retry handling, pilot-label loss on
   retry** — Tier 1, all verified against production with three fresh
   sessions (mixed study, gym/bus, diagram preference) before and after.
3. **Decision/claim split, researcher review taxonomy (contradicts/
   outside_scope), free-text topic proposal, follow-up link reissue,
   withdrawal-blocks-delivery atomicity** — Tier 2, verified with a full
   local journey (discovery → confirmation → eligibility → baseline →
   crux → assignment → researcher review → delivery → measurement →
   follow-up → reissue) plus the outside_scope and inaccurate-brief
   review paths. This run found and fixed two real bugs:
   `legacyDisposition()` mapping "supports" to a disposition value the DB
   check constraint didn't accept, and the OpenAI client having no
   explicit timeout (one real call hung ~11 minutes before this session
   added a 20s client-side timeout).
4. **Automatic delivery** (removing the mandatory human-review
   dependency) — a separate, explicitly-scoped build: deterministic
   verbatim-claim delivery (unchanged, confirmed by inspection — no model
   call ever composes delivered text), a closed per-pack claim-kind
   policy with a fixed evidence relation per kind, a classifier that
   picks a kind or none/unclear (server-validated, never force-matched),
   an atomic Postgres function for delivery, system-validation records
   distinct from human reviewer records (DB constraint-enforced), and a
   `DELIVERY_MODE` switch with the manual flow kept fully intact as a
   fallback. This step found and fixed: a missing `approvals.template_version`
   column (every real auto-delivery attempt 500'd until fixed), and a
   policy bug where the only kinds were "contradicts" — making a
   supported belief structurally unreachable until a "supports" kind was
   added for every claim direction.

## Test results — mocked vs. real, kept separate

**Unit tests (mocked/pure, no network, no database): 107/107 pass.**
Covers: provenance citation resolution, mixed-driver routing, the
required regression (`candidate_ready` + provenance-nulled core field →
repair/recovery, never a blank park), state-machine transition legality,
the approval disposition mapping (every (briefAccurate, evidenceRelation)
combination against the DB's allowed values), the pack policy's
structural integrity (every pack has ≥1 supports kind; every contradicts
kind has a named supports mirror grounded in the same claim IDs; no
missing grounding), and the auto-delivery routing decision.

tsc, lint, and `next build` all pass at the deployed commit.

**Real-model, real-database end-to-end tests:**

- `tests/e2e/eligible-activity-flow.spec.ts` — full manual-mode journey
  (discovery → confirmation → eligibility → baseline → crux → assignment
  → researcher login → draft → approve → delivered → ack → post-score →
  follow-up, including link reissue after a simulated refresh). Pass.
- `tests/e2e/review-outcomes.spec.ts` — outside_scope review (terminal
  refusal) and inaccurate-brief review (returns to `assigned` for a fresh
  draft, not a terminal refusal). Pass, both.
- `tests/e2e/auto-delivery.spec.ts` — 5 tests, no researcher login
  anywhere: a supports-direction claim reaching delivery/measurement/
  receipt; an out-of-scope claim ending discovery-only with zero claims
  delivered; idempotent refresh (no duplicate delivery); withdrawal
  blocking release outright; a genuine preference still parking at
  discovery without ever reaching the auto-deliver pipeline. Pass, all 5.

**Real-model classifier check, 16 natural claims** (not written to match
policy wording), across all three packs, in four categories — empirical
belief, preference-only, vague, and out-of-scope, plus six written to
match a "supports" direction:

| Category | Count | Outcome |
|---|---|---|
| Empirical belief (contradicts-direction) | 3 | 3/3 matched the intended kind |
| Empirical belief (supports-direction) | 6 | 5/6 matched the intended kind; 1 (deliberately soft wording) returned `unclear` |
| Preference-only | 3 | 3/3 correctly returned `none` |
| Vague | 2 | 1 `unclear`, 1 `none` (reasonable either way) |
| Out-of-scope | 2 | 2/2 correctly returned `none` |

No hallucinated category, no cross-pack match, no force-match, across all
16 real model calls.

## Production smoke test (post-deploy, no login)

Three fresh sessions against the live deployment, each marked `is_test=true`:

| Case | Outcome | Notes |
|---|---|---|
| Supports-belief story | Delivered → ack → measured → receipt | `reviewType: "automatic"`, `reviewDescription: "system validation"`, policy/pack/template versions all populated |
| Pure preference | Parked at discovery | Specific reason shown, not blank |
| Out-of-scope claim | Discovery-only (parked at auto-deliver) | Exact required message, zero claims delivered |

**Discovery-turn latency across all three runs** (12 discovery turns
total): **p50 ≈ 11.65s, max ≈ 22.6s** (one outlier; the other 11 turns
ranged 8.9–12.8s). The 22.6s turn cannot be conclusively attributed to a
single slow model call versus a client-side 20s-timeout-then-retry — the
server logs the phase breakdown per turn, but Vercel's log CLI only
streams live runtime logs, and that specific request was no longer in
the live window by the time it was checked. This is reported as an open
question, not a resolved one.

## Known, explicitly deferred (not claimed fixed)

- The pack policy table (`lib/pack-policy.ts`) is marked a draft; it
  covers a hand-picked set of claim directions per pack, not an
  exhaustive one. A natural claim outside its current coverage correctly
  returns `none` (discovery-only) rather than a wrong match — conservative
  by design, but means recall is incomplete.
- A full transactional rewrite of the entire approve-and-deliver sequence
  as one atomic unit (beyond the withdrawal check, which is enforced
  atomically via a database trigger) was not attempted.
- Multi-session resume, persistent cross-instance rate limiting, and a
  full concurrent-race test matrix remain out of scope (`docs/deferred.md`).
- A fast-mode/alternate-model latency benchmark was never run — there is
  no record of it in this session, and nothing related was deployed.

## What this evidence does *not* establish

This document reports functional correctness and reproducibility of the
discovery → eligibility → evidence-delivery → measurement pipeline, under
both manual and automatic review modes, against real model calls and a
real database. It does **not** establish, and makes no claim toward,
whether seeing audited evidence actually changes what any participant
believes. That would require a pilot with real participants, pre/post
measurement, and a sample size this document's three synthetic smoke-test
sessions cannot provide — and even a successful small pilot (e.g. three
people) would show usability and completion, not causal persuasion
efficacy.
