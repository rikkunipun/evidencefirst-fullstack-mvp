# Build status — fullstack-mvp

Last updated: 2026-10-08 (continuous, see git log for exact times).

## 🔴 Blocked — needs your input

**`apps/web/.env.local` has the wrong Supabase keys.** Checked by prefix/length only (never printed in full):

| Variable | Current value looks like | Problem |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | *(empty)* | Not set at all. |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_publishable...` (46 chars) | This is the **publishable** key, not the secret/service-role key. |

Effect: migrations and schema changes work fine (those go over a direct Postgres connection using `SUPABASE_DB_PASSWORD`, which **is** correct). But every `supabase-js` call made with `SUPABASE_SERVICE_ROLE_KEY` — seeding evidence units, and every server route handler once built — is actually authenticating as the public `anon`/`authenticated` role, not `service_role`. I confirmed table grants and RLS are correct server-side (`service_role` has `rolbypassrls=true` and full grants); the key itself is just the wrong one. I will not work around this by widening `anon`/`authenticated` grants — that would punch a real hole in the data (e.g. public write access to `evidence_units`).

**What I need from you:** open Supabase dashboard → Project Settings → API keys, and give me:
1. The **secret / service_role** key (new format starts `sb_secret_...`, legacy format is a long `eyJ...` JWT with `"role":"service_role"`).
2. The **publishable** key (`sb_publishable_...` or legacy `eyJ...` anon JWT) for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

I'm continuing with everything that doesn't need live DB writes (routes, pages, pure-logic unit tests, build) while waiting.

## ✅ Done

- `fullstack-mvp` branch created via `git worktree` from reference commit `f830f11c`, without touching `main`/`dist`.
- `docs/implementation-plan.md`, `docs/reference-manifest.md` (checksums of the two preserved prototype files).
- Next.js 16 / React 19 / TypeScript / Tailwind v4 scaffold in `apps/web`, Zod v4, `@supabase/supabase-js` + `@supabase/ssr`, `openai` v7 (Responses `parse` + `zodTextFormat` confirmed available), Vitest, Playwright.
- Full DB schema applied to the **real** Supabase project (migrations `0001_init`, `0002_rls`, `0003_grants`, tracked in a `schema_migrations` table so re-runs are idempotent): all tables from the plan, append-only/immutability triggers on frozen tables, RLS enabled with zero client-facing policies (deny-all; service-role bypass only).
- Pure, unit-testable logic modules: `lib/state-machine.ts`, `lib/eligibility.ts` (6 gates), `lib/crux.ts` (2-pass cap), `lib/assignment.ts` (permuted-block 1:1), `lib/evidence.ts` (3 packs ported verbatim from `dist/evidence-packs.js`), `lib/followup.ts`, `lib/delivery-template.ts` (constrained composition, no free prose).
- `lib/env.ts` (Zod-validated env, fails loudly on missing credentials), `lib/capability.ts` (hashed resume/follow-up tokens, signed cookie), `lib/supabase/service-client.ts`, `lib/supabase/admin-auth.ts` (Supabase Auth + `ADMIN_EMAILS` allowlist), `lib/ai/prompt.v1.ts` + `lib/ai/discovery.ts` (versioned prompt, provenance enforcement, bounded fallback), `lib/zod/discovery.ts` + `lib/zod/requests.ts`.

## ⏳ In progress / next

- Evidence-unit seed script written (`db/seed.ts`) but **cannot run until the service-role key is fixed** (currently fails with "permission denied for table evidence_units", confirming the key, not the schema, is wrong).
- Participant/researcher API routes and pages (slices 2–4).
- Vitest unit tests for the pure modules above (don't need DB; will run regardless of the credential blocker).
- Playwright e2e, production build, deploy, pilot script, submission evidence (slice 5).

## Known risks carried from the brief

- Deployment requires the owner's interactive `vercel login`; I cannot complete that OAuth flow myself.
- Human pilot interviews (Sai Teja, Akhilesh, Anand) must be conducted by the owner.
- 24-hour window: if time runs out, consent/gating/evidence-integrity code ships before export/a11y polish.
