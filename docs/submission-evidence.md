# Submission evidence

Branch `fullstack-mvp`, worktree of reference commit `f830f11c1b9e870c8edd18fbb9a9b1512ee8a293` (that commit and `dist/` are untouched — checksums in `docs/reference-manifest.md`).

## Repository state

- Full commit history on `fullstack-mvp`: plan → scaffold/schema → slice 1 (consent/auth) → slice 2 (discovery/gates/crux/assignment) → slice 3 (review/delivery) → slice 4 (measurement/follow-up/export) → this file.
- Every commit's message states what was actually verified, not just written.

## What is real vs. what is not

**Real, verified against the live stack (Supabase project + OpenAI API), this session:**
- Full participant journey, discovery through delivery, run live at least twice (one full pass through researcher approval and delivery; one run where the model itself judged the case not-stable-enough and parked it — both are legitimate real outcomes).
- All six eligibility gates exercised with real pass/fail reasoning.
- Crux loop with a real AI classification call.
- Real idempotent 1:1 permuted-block assignment via a Postgres function, verified both for first-assignment and retry-is-idempotent behavior.
- Real researcher login, draft generation, approval, immutable delivery commit.
- Real reversal QA: an overbroad claim refused with zero factual claims; an exact approved claim confirmed as supported (so the refusal path isn't a blanket "always refuse"); a verbatim claim from a *different* enabled pack still refused (true membership check, not keyword match).
- Real post-measurement, follow-up creation, "not yet due" enforcement, receipt generation, and refresh/resume — all byte-exact against what was actually persisted.
- A real Vercel build succeeded with the actual production dependency set (see `docs/deployment.md`) — the deployment itself is not yet public (see Limitations).

**Explicitly NOT real:**
- No real participants have been recruited or interviewed by me. `docs/pilot-script.md` is prepared for the owner to run three real 15–20 minute sessions (Sai Teja, Akhilesh, Anand) separately.
- Any session IDs, participant codes, or receipts referenced in this document from automated testing were deleted after verification (see git commit messages for the specific cleanup steps) — they are not part of the submitted dataset.
- No claim of "efficacy" or "which condition performed better" is made anywhere in this codebase or these docs. The experiment is order-personalization only (same five claims, reordered), per the brief's explicit scope limitation.

## Test evidence

- 61 Vitest unit tests across 9 files (eligibility gates incl. every fail/unknown case, state-machine transitions incl. terminal-state rejection, crux two-pass cap, permuted-block assignment balance/determinism/exhaustion, evidence pack invariants incl. exact-match reversal lookup and cross-pack rejection, follow-up due-date math, extraction field-merge semantics, delivery-template word-budget equality and content-hash determinism, discovery provenance enforcement incl. fabricated-citation rejection).
- Playwright e2e, split by determinism:
  - `eligible-activity-flow.spec.ts` — live OpenAI + live Supabase, full discovery→delivery→measurement→follow-up→receipt→resume. Non-deterministic by nature (a real model is making real judgment calls); the one documented full pass is the "at least one live-model check" the brief requires.
  - `post-delivery-flow.spec.ts`, `parked-flow.spec.ts`, `reversal-qa.spec.ts`, `mobile-layout.spec.ts` — 13 deterministic tests, DB-seeded or pure-logic, repeatable on every run (all 13 passing). These are the primary signal.
- `tsc --noEmit` and `next build` clean throughout; re-verified after every slice.

## Claim audit (how "every delivered factual claim maps to an evidence-unit version" is actually true)

Not a post-hoc checker — structural. `lib/delivery-template.ts` composes delivered text from exactly three ingredients: (1) the pack's approved claim text, verbatim, selected from `lib/evidence.ts` (which is the exact same content as the seeded `evidence_units` DB rows — see `docs/reference-manifest.md` / `db/seed.ts`); (2) the pack's approved boundary text, verbatim; (3) one fixed connective template with the participant's own (HTML-escaped) reason text. There is no code path from a model response into delivered text. `lib/content-hash.ts` binds the approval to the exact text+claim-order+template-version triple, and the approval route re-checks that hash before committing the immutable `deliveries` row.

## Limitations, tied to brief acceptance criteria

| Acceptance criterion | Status |
|---|---|
| Consent → text session, unassisted | ✅ built and live-tested |
| Push-to-talk, mic denial | ❌ **not built** — out of scope per brief §12 ("ship the reliable text path first... voice... deferred") |
| Refresh restores correct state at every step | ✅ tested for delivered/ack_recorded/measured/followup_due; discovery-mid-conversation refresh not separately tested (would need a paused live-model session) |
| Behavior-gap/parked case, clear reason | ✅ tested deterministically (no-cost gate, no-pack/checkable gate) |
| Eligible case reaches baseline→assignment→approval→delivery→measurement | ✅ live-tested |
| Fixed/personalized equal claim count & word budget | ✅ unit-tested (`delivery-template.test.ts`, `evidence.test.ts`) |
| Every delivered claim has an enabled evidence-unit ID + source link | ✅ structural guarantee, see above |
| Unsupported-domain case cannot reach persuasion | ✅ tested deterministically (`checkable` gate fails for topics with no enabled pack) |
| Reversal run refuses, zero delivered claims | ✅ tested live |
| Researcher sees complete trace, exports it | ✅ `/admin/sessions/[id]` 11-section trace; `/admin/export` csv/json |
| OpenAI key absent from client bundles/logs | ✅ server-only everywhere (`server-only` package enforced); not yet re-verified against an actual deployed bundle (blocked on public deployment) |
| Production works from an unrelated device/account | ⚠️ **blocked** — see `docs/deployment.md`; the Vercel build itself succeeded with real env vars, but the resulting URL is behind Vercel's own auth wall until the project is claimed into a real account (needs a Vercel token or interactive login from the owner) |
| Evidence library editing actually gates delivery | ⚠️ **documented simplification** — `/admin/evidence` reads/displays the DB rows; delivery composition reads the in-code constants (identical content, same source). Toggling `enabled` in the DB does not yet change what's delivered. |
| Reason-matched (non-order) personalization | ❌ explicitly out of scope per brief — only `order_personalization_v1` implemented |
| Three real pilot interviews | ❌ not run by me — `docs/pilot-script.md` prepared for the owner |

## What a fresh environment needs to reproduce this (see also `docs/deployment.md`)

```sh
cd apps/web
npm install
cp .env.example .env.local   # fill in real values
npm run db:migrate
npm run db:seed
node scripts/provision-admins.mjs   # prints a one-time researcher password
npm run dev
```

Test commands: `npm run test:unit` (Vitest), `npm run test:e2e` (Playwright; starts its own assumptions about a running `npm run dev` on localhost:3000 — see `playwright.config.ts`), `npm run build` (production build + typecheck).
