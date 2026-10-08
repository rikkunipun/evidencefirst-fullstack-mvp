# Build status — fullstack-mvp

Last updated: 2026-10-08 (continuous, see git log for exact times).

## ✅ Resolved — Supabase keys

You corrected `apps/web/.env.local`. Re-verified by prefix/length only: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` now starts `sb_publishable_` (46 chars), `SUPABASE_SERVICE_ROLE_KEY` now starts `sb_secret_` (41 chars). Seeded the evidence library against the real project: 15 rows in `evidence_units` (5 claims × 3 packs: `activity`, `study`, `learning`), confirmed via a live `select` with the service-role key.

## ✅ Done

- `fullstack-mvp` branch created via `git worktree` from reference commit `f830f11c`, without touching `main`/`dist`.
- `docs/implementation-plan.md`, `docs/reference-manifest.md` (checksums of the two preserved prototype files).
- Next.js 16 / React 19 / TypeScript / Tailwind v4 scaffold in `apps/web`, Zod v4, `@supabase/supabase-js` + `@supabase/ssr`, `openai` v7 (Responses `parse` + `zodTextFormat` confirmed available), Vitest, Playwright.
- Full DB schema applied to the **real** Supabase project (migrations `0001_init`, `0002_rls`, `0003_grants`, tracked in a `schema_migrations` table so re-runs are idempotent): all tables from the plan, append-only/immutability triggers on frozen tables, RLS enabled with zero client-facing policies (deny-all; service-role bypass only).
- Pure, unit-testable logic modules: `lib/state-machine.ts`, `lib/eligibility.ts` (6 gates), `lib/crux.ts` (2-pass cap), `lib/assignment.ts` (permuted-block 1:1), `lib/evidence.ts` (3 packs ported verbatim from `dist/evidence-packs.js`), `lib/followup.ts`, `lib/delivery-template.ts` (constrained composition, no free prose).
- `lib/env.ts` (Zod-validated env, fails loudly on missing credentials), `lib/capability.ts` (hashed resume/follow-up tokens, signed cookie), `lib/supabase/service-client.ts`, `lib/supabase/admin-auth.ts` (Supabase Auth + `ADMIN_EMAILS` allowlist), `lib/ai/prompt.v1.ts` + `lib/ai/discovery.ts` (versioned prompt, provenance enforcement, bounded fallback), `lib/zod/discovery.ts` + `lib/zod/requests.ts`.

## ✅ Slice 1 complete (scaffold, schema, auth, consent/capability)

Smoke-tested live against the real Supabase project and `next dev` (not just typecheck):
- `POST /api/sessions` → creates participant + session + consent event + context answer, issues signed resume cookie, transitions `consented -> context`. Verified real row in Postgres, then cleaned up the smoke-test row.
- `GET /api/sessions/:id` → 404 without the cookie, full state snapshot with it. Cookie-forgery resistance confirmed (ID alone doesn't work).
- `/admin` → 307 redirect to `/admin/login` when signed out (middleware + layout guard both exercised).
- Researcher account provisioned via `scripts/provision-admins.mjs` for `rikkunipun23@gmail.com` (password shown once in terminal, not stored in any file).
- `tsc --noEmit` clean across the whole app.

Landing (`/`), consent+context flow (`/participate`), admin login/dashboard shell all render and round-trip correctly.

## ✅ Slice 2 complete (real model-backed discovery → confirmation → gates → freeze → crux → pre-evidence → assignment)

Ran a **full live end-to-end session** against the real OpenAI API and real Supabase project (not mocked), then deleted the smoke-test rows:

- `POST /api/sessions/:id/messages` — real `responses.parse` + `zodTextFormat` discovery turns, one question at a time, 25-word cap, provenance-checked extraction, stopped correctly at `candidate_ready` after 5 questions (budget is 8) and generated a read-back from real extracted fields.
- `POST /api/sessions/:id/confirm` — participant-edited wording frozen as `confirmed_wording`.
- `POST /api/sessions/:id/eligibility` — all six gates evaluated deterministically from real answers + real pack lookup + real model safety flag; all passed in this run, each with a correct plain-language reason.
- `POST /api/sessions/:id/baseline` — froze belief wording, scope/time, consequence, baseline score (9); immutable (no UPDATE trigger).
- `POST /api/sessions/:id/crux` — reason → reflect → confirm → hypothetical score (fell below baseline) → real `responses.parse` classification call returned `current_claim`.
- `POST /api/sessions/:id/pre-evidence` — recorded the pre-evidence score, then called the `assign_condition` Postgres RPC: real 1:1 permuted-block assignment (`fixed`), verified idempotent (second call correctly 409'd with `invalid_state: assigned`, not a re-assignment).
- Full snapshot (`GET /api/sessions/:id`) matched every persisted field exactly.

Participant UI: `/s/[id]` now renders every stage through "assigned" (discovery chat, confirmation read-back, plain eligibility form, baseline/pre-evidence score pickers, crux loop, waiting screen, parked screen) driven entirely by server state — no client-side state guessing.

Added `assign_condition` Postgres function (`0007`/`0008` migrations) for atomic, lock-based, idempotent assignment — required a fix for a column-name ambiguity bug caught by live testing, not just review.

**48 Vitest unit tests, all passing**, covering: all 6 eligibility gates (pass/fail/unknown, including "unknown never passes"), state-machine legal/illegal transitions + terminal-state rules, crux 2-pass-cap decision logic, permuted-block assignment (1:1 balance, determinism, exhaustion), evidence pack invariants (enabled-topic boundaries, equal claim/word budgets, exact-match reversal lookup, immutability), follow-up due-date math, and extraction field-merge semantics.

`tsc --noEmit` and `next build` both clean.

**Known quality gap (not blocking):** the auto-generated read-back sentence was initially grammatically awkward because the model extracted full sentences instead of short phrases for chosen_action/rejected_alternative/expected_outcome. Patched the prompt to require short noun phrases for those three fields specifically — not yet re-verified live (next session should confirm).

## ⏳ Next (slices 3–5)

- Researcher draft generation, approval, constrained delivery composition, immutable delivery receipt, reversal QA page (slice 3).
- Post-measurement, follow-up link/page, de-identified export (slice 4).
- Playwright e2e, a11y/mobile pass, deploy, pilot script, submission evidence (slice 5).

## Known risks carried from the brief

- Deployment requires the owner's interactive `vercel login`; I cannot complete that OAuth flow myself.
- Human pilot interviews (Sai Teja, Akhilesh, Anand) must be conducted by the owner.
- 24-hour window: if time runs out, consent/gating/evidence-integrity code ships before export/a11y polish.
