# Deployment

## What's been verified

I ran `vercel deploy --temporary` (no login required) from `apps/web`, passing every required env var via `-e`/`-b` flags read directly from `.env.local` (never printed to logs). Result: **a real build, with the real production dependencies, succeeded on Vercel's infrastructure** — Next.js 16 compiled, typechecked, and generated all 29 routes in 51s on their build machine. Deployment ID `dpl_2BMHKwPLccmHMiC4fS5dE5DdY1Tz`, `readyState: "READY"`.

**This specific URL is not public**, though: `--temporary` deployments are unclaimed and Vercel puts them behind its own "Vercel Authentication" wall (`deploymentProtection: ["vercel_authentication"]`) until an account claims them — visiting it redirects to a Vercel login, not the app. Confirmed with a plain `curl`: `302` to the Vercel auth gate. So the build/runtime path is proven end-to-end, but I cannot produce a public URL without your account.

## What I need from you to finish this

Either of these unblocks a real public URL, in order of least friction:

1. **A Vercel personal access token** (vercel.com → Account Settings → Tokens → Create). Give me the token value; I can run `vercel --token=<token>` non-interactively — no browser OAuth needed — to link/create a real project under your account and deploy to production (which is public by default on a Hobby plan, unlike unclaimed temporary deployments).
2. **Or**, you run `vercel login` yourself in a terminal (interactive OAuth; I can't complete this step), then tell me to continue — I'll pick up from `vercel link` onward.

## Steps once authorized (either path)

```sh
cd apps/web
vercel link          # creates/links a project (first time only)
vercel env add NEXT_PUBLIC_APP_URL production        # repeat per var below
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_DB_PASSWORD production
vercel env add OPENAI_API_KEY production
vercel env add OPENAI_TEXT_MODEL production
vercel env add ADMIN_EMAILS production
vercel env add SESSION_TOKEN_SECRET production
vercel --prod
```

After `NEXT_PUBLIC_APP_URL` is known (the real production domain), update it and redeploy so follow-up links point at the right host.

## Production verification checklist (run after deploying)

From a clean/incognito browser, unrelated to this machine:

- [ ] `/` loads, consent flow starts at `/participate`
- [ ] A text discovery session completes (real OpenAI call) through confirmation
- [ ] Refresh mid-session restores the exact same step
- [ ] `/admin/login` requires real credentials; `/admin` is unreachable without them
- [ ] A researcher can draft → approve → see `delivered` state
- [ ] Participant sees the exact delivered text and can submit a post-score
- [ ] Follow-up link shows "not yet due"
- [ ] View page source / Network tab: `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are absent from every response and script bundle
- [ ] `/admin/reversal` refuses an overbroad claim with zero delivered factual claims

## Supabase

Already on the real hosted project (`yeooceyhndurtpqnpncn.supabase.co`), migrations tracked in `schema_migrations`, evidence seeded. No additional Supabase setup needed for deployment — just point Vercel's env vars at the same project (or a fresh one, running `npm run db:migrate && npm run db:seed` against it first).
