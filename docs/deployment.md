# Deployment

## Public production URL

**https://evidencefirst-fullstack-mvp.vercel.app**

Verified from a clean environment (no cookies, no prior session) after real deployment:

- `GET /` → 200, real rendered HTML, no Vercel auth wall
- `GET /participate` → 200
- `GET /admin` → 307 redirect to `/admin/login` (unauthenticated correctly blocked)
- `POST /api/sessions` → real row created in the production Supabase project, `Secure; HttpOnly; SameSite=lax` cookie issued
- `POST /api/sessions/:id/messages` → real OpenAI call, real discovery question returned
- Admin login via the actual `/admin/login` form (Playwright, real browser) → succeeds, draft/approve/reversal all work against production
- Scanned the landing/participate/admin-login HTML and every loaded JS chunk for `sk-proj-`, `sb_secret_`, and the raw secret env var names: zero matches in all of them

13/13 deterministic Playwright tests pass against this URL (`PLAYWRIGHT_BASE_URL=https://evidencefirst-fullstack-mvp.vercel.app npx playwright test ...`), in addition to passing against local dev.

## How it was deployed

```sh
cd apps/web
vercel link --yes --project evidencefirst-fullstack-mvp   # creates/links the project
# env vars pushed one at a time from .env.local via `vercel env add <KEY> production`,
# piping the value on stdin so it's never in shell history or process args
vercel --prod
```

Project: `rikkunipuns-projects/evidencefirst-fullstack-mvp` (`prj_jSf5nHTxmLxjAJvNPr8fWWP9cSq1`).

### Two real bugs this deployment caught

1. **`.env.local` formatting**: `NEXT_PUBLIC_SUPABASE_URL` had a leading space after `=` (`URL= https://...`), which broke shell-based env loading (`source .env.local`) though Node's `dotenv` package tolerated it silently. `OPENAI_API_KEY` had a trailing space, which Node's dotenv *also* tolerated, but Vercel's env store did not — flagged with "Value ends with whitespace" and would have shipped a broken `Authorization: Bearer ...<space>` header in production. Both fixed at the source.
2. **Missing `NEXT_PUBLIC_APP_URL` in production** caused `getEnv()` to throw on every request that touched it (`/admin` and `/api/sessions`), surfacing as a generic 500 instead of the correct redirect/response. Added it once the real domain was known, redeployed, re-verified both routes now behave correctly (307 to login; 200 with a real session).

## Environment variables (Production, Vercel)

All 9 required vars are set (`vercel env ls production`): `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, `ADMIN_EMAILS`, `SESSION_TOKEN_SECRET`.

## Supabase

Same real hosted project as local dev (`yeooceyhndurtpqnpncn.supabase.co`) — no separate production database was provisioned for this capstone window. Migrations tracked in `schema_migrations`; evidence seeded (15 units, 3 packs).

## Production verification checklist (completed)

- [x] `/` loads, consent flow starts at `/participate`
- [x] A text discovery session completes a real OpenAI call
- [x] `/admin` requires real credentials; redirects correctly when signed out
- [x] A researcher can log in, draft, approve → `delivered` (verified via Playwright against the live URL)
- [x] Reversal QA refuses an overbroad claim with zero delivered factual claims (verified live)
- [x] `OPENAI_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` absent from every HTML response and JS chunk (verified by direct grep against the live bundles)
- [x] No horizontal overflow at 360px/390px (Playwright, against the live URL)

**Not yet done** (left for the owner, per the brief — pilot interviews are the owner's responsibility, not mine): a real human clicking through on a physical phone. The automated checks above substitute for that during this session.
