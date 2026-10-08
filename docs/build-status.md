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

## ⏳ In progress / next

- Evidence-unit seed script written (`db/seed.ts`) but **cannot run until the service-role key is fixed** (currently fails with "permission denied for table evidence_units", confirming the key, not the schema, is wrong).
- Participant/researcher API routes and pages (slices 2–4).
- Vitest unit tests for the pure modules above (don't need DB; will run regardless of the credential blocker).
- Playwright e2e, production build, deploy, pilot script, submission evidence (slice 5).

## Known risks carried from the brief

- Deployment requires the owner's interactive `vercel login`; I cannot complete that OAuth flow myself.
- Human pilot interviews (Sai Teja, Akhilesh, Anand) must be conducted by the owner.
- 24-hour window: if time runs out, consent/gating/evidence-integrity code ships before export/a11y polish.
