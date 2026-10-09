# Build status — fullstack-mvp

Last updated: 2026-10-09 (continuous, see git log for exact times).

## ✅ 2026-10-09, before 2:15 PM — admin-only researcher-usability change

Scope: `/admin` pages/routes only, plus the one explicitly-authorized exception (reading `?pilot=` on `/participate`). State machine, evidence, delivery untouched.

- Every state card on `/admin` (incl. Parked, Follow-up due) now links to a new `/admin/sessions?state=<state>` list page.
- Each list row: pilot label, state, topic, parked reason (plain language, already stored), created time, last participant activity, follow-up due date — all in IST, labelled, DB still UTC.
- "Last participant activity" is computed from `messages` (role=participant), not `updated_at` — confirmed `updated_at` was an hour stale on an old row (the `is_test` migration's side effect the instruction warned about).
- Real/test/all data filter, defaulting to real, on the dashboard counts and every session list.
- Optional pilot label (migration 0013, nullable, additive): `/participate?pilot=<label>` stored on the session, shown + clickable-to-filter in admin lists.
- Verified live against production with real Playwright runs (not just locally): clickable cards, correct columns, IST labelling, real-filter hides test fixtures while all/test reveal them, a real `/participate?pilot=anand` session stored and visible in the filtered list. Zero secrets in the scanned pages.
- 61 Vitest + 13 deterministic Playwright passing, no regressions; `tsc`/lint/`next build` all clean. Redeployed to the same production URL.

## ✅ 2026-10-09 pre-pilot P0/P1 repair pass (tag `checkpoint-pre-repair` marks the state before this)

Source: `EvidenceFirst_Fullstack_Live_Audit_Oct9.md` + `EvidenceFirst_Fullstack_QA_Matrix_Oct9.json`. Worked the P0 list only, in order, one commit per item, then P1 since time remained. Pilots at 3:00 PM IST; stopped new work at 2:30 PM IST as instructed.

**P0 (all 6 done):**
1. Preserve typed input — `/participate` no longer drops a typed free-text story when a card is also selected; the messages route inserts that story as the real first turn instead of silently discarding it. Verified live: the model built directly on the typed story instead of re-asking.
2. Pre-approval payload leak — new `ParticipantSessionSnapshot` DTO (`lib/types/session.ts`/`lib/session-snapshot.ts`) structurally omits `assignment`, `draft`, `approval`, `latestExtraction` from every participant response/prop. Verified live on production: those keys are absent, not null.
3. `assign_condition` privileges — revoked PUBLIC/anon/authenticated EXECUTE, pinned `search_path`. Verified against the real database with `has_function_privilege`: only `postgres`/`service_role` can call it.
4. Thinking state / timeout+retry / latency logging / park wording / "Try a different decision" — 30s bounded timeout with a visible spinner and a Retry that never loses the typed answer; `[discovery-turn-latency]` logged server-side on every turn; parked/refused screens got a real exit path; the checkable-gate park message no longer implies a blanket inability to discuss the topic (reserves "safely discuss" for the actual safety gate).
5. Evidence usability — delivery HTML (with real clickable source links + locators) was already being generated and stored but never selected or rendered; now it is. Follow-up link is a real `<a>` plus a working copy button.
6. `is_test`/`test_run_id`, export defaults, 18+ consent, no voice claims — migration 0011; the audit's 7 fixture sessions + its reversal run marked test; 5 *additional* pre-existing sessions found and marked too (since nothing before the 3 PM pilot start can be real participant data by definition) — verified 0 real sessions remained going into the pilots. Export defaults to excluding test rows. Removed the two remaining "speak"/"transcribed" claims; added an explicit 18+ line to both the landing page and the actual consent checkbox.

**P1 (all 3 done, time permitted):**
- Idempotency key (`client_token`) on discovery answer submission — a retried request after a timeout can't create a duplicate turn or a duplicate model call. Verified live with an identical-token retry.
- Friendlier double-click guard on approval — `deliveries.session_id` was already UNIQUE; a true concurrent double-click now gets a clean 409 `already_approved` instead of a 500. Verified with a real concurrent `Promise.all` double-approve: `[200, 409]`, exactly one delivery row.
- Basic in-memory rate limiting on session creation (10/10min/IP) and discovery turns (30/10min/session) — documented as per-instance, not distributed-grade. Verified live: 11th request in the window returns 429.

**Deferred** (listed with reasoning in `docs/deferred.md`): semantic review taxonomy, multi-session resume, expanded receipts, staging database, full race-condition suite, entailment-grade provenance, classifier-failure routing, service-failure-vs-parking distinction, explicit spend limits, review-state persistence across refresh.

**Final verification:**
- 61 Vitest + 13 deterministic Playwright passing (local and production).
- `tsc --noEmit` clean.
- `npm run lint`: fixed all 12 errors the audit found (unescaped apostrophes, one `require()` import) down to **0 errors, 0 warnings**.
- `next build` (Turbopack) clean, 29 routes.
- Redeployed to **https://evidencefirst-fullstack-mvp.vercel.app**; re-verified fresh (no prior cookies): consent/18+ line present, no voice claims, typed-story fix live, participant-DTO leak fix live (keys absent), idempotency dedup live, zero secrets across every HTML page and JS chunk actually served.
- Did not rerun the full live-model e2e suite against production (per instruction) — verified the specific fixes above directly instead.

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

## ✅ Slice 3 complete (server assignment already done in slice 2; researcher review, constrained delivery, immutable receipt, reversal QA)

**First real Playwright e2e test, run against the live OpenAI API and live Supabase project, green end to end** (`tests/e2e/eligible-activity-flow.spec.ts`, ~70s): consent → 5 real scripted discovery turns → confirmation → all 6 eligibility gates pass → baseline freeze → crux (real classification call → `current_claim`) → pre-evidence + idempotent assignment → **real researcher login through the actual `/admin/login` UI** (throwaway rotated password, never hardcoded) → `POST /api/admin/sessions/:id/draft` → `POST /api/admin/sessions/:id/approve` → final state `delivered` with exactly 5 claim IDs and exact text. Cleans up every row it created, pass or fail.

Also added `tests/e2e/reversal-qa.spec.ts` (3 tests, all passing against the real DB): overbroad unsupported claim → refused, zero delivered factual claims; an actually-approved exact claim → correctly reports support (so refusal isn't just "always say no"); verbatim text from a *different* enabled pack → still refused (membership, not keyword matching). These 3 real reversal receipts are intentionally left in `reversal_runs` as genuine first-class reversal-QA evidence per the brief, not deleted like other test fixtures.

Caught and fixed a real bug via this live testing: `POST /api/admin/sessions/:id/draft` was returning raw snake_case DB columns (`claim_order`, `content_hash`, …) instead of the camelCase shape the rest of the API uses — would have silently broken the admin UI's "generate draft" flow. Fixed to return `{ claimOrder, renderedText, renderedHtml, wordCount, contentHash }`.

Delivery composition is **constrained by construction**: `lib/delivery-template.ts` only ever emits approved claim IDs' exact text, the pack's exact boundary text, and a fixed connective template with the participant's reason HTML-escaped — there is no model call and no free-form text path in the delivery pipeline, so "reject unmapped or broader wording" is structurally guaranteed rather than caught by a verifier pass. Immutable `deliveries`/`approvals`/`draft_revisions` rows (DB-trigger blocked from UPDATE); approval checks the draft's `content_hash` and rejects a stale approval.

Admin UI added: `/admin/sessions/[id]` (full 11-section vertical trace + draft/approve controls), `/admin/reversal` (form + receipt), `/admin/evidence` (read-only list — see documented limitation below).

**Documented limitation:** delivery composition reads the in-code `EVIDENCE_PACKS` constants (identical content to the DB, seeded from the same source), not the DB rows live. Toggling `enabled` on an `/admin/evidence` row does not yet gate delivery. Given the 24h window this was deferred rather than built half-correctly; `/admin/evidence` is explicit about this in its own copy.

61 Vitest unit tests + 4 Playwright e2e tests, all passing. `tsc --noEmit` and `next build` both clean (10 routes now).

## ✅ Slice 4 complete (post-measurement, refresh/resume, parked/refusal, follow-up, export)

- `POST /api/sessions/:id/ack`, `POST /api/sessions/:id/measurements` (post-evidence; rejects submission before ack), `GET/POST /api/follow-up/[token]` (honest "not yet due" before due_at, idempotent single collection, due_at = delivered_at + exactly 7 days), `GET /api/sessions/:id/receipt`, `GET /api/admin/export?format=csv|json` (de-identified by participant code, formula-injection-safe CSV cells).
- Fixed a real DB bug caught by this work before it ever ran: the blanket immutability trigger on `deliveries` blocked the legitimate one-time `displayed_ack_at` write. Replaced it with a trigger (migration `0009`) that allows exactly that one field, exactly once, and still blocks every other mutation (including re-acking and any change to exact delivered content).
- Participant UI: `DeliveryView`, `PostMeasurementView`, `ReceiptView`, `/follow-up/[token]` page — all wired into `SessionView` by server state only.

**9 new Playwright tests added, split deliberately by determinism:**
- `tests/e2e/post-delivery-flow.spec.ts` (2 tests, DB-seeded to `delivered`, no live model calls, ~8s total): ack→post-score→follow-up-not-due→receipt→refresh/resume all verified byte-exact; confirms an unauthenticated request with just the session ID gets 404.
- `tests/e2e/parked-flow.spec.ts` (2 tests, deterministic): no-actual-cost case parks via the real `consequential` gate; a topic with no enabled pack parks via the real `checkable` gate (this is the "unsupported-domain case cannot reach persuasion" acceptance criterion) — both assert `baseline`/`assignment`/`delivery` stay null.
- Extended `eligible-activity-flow.spec.ts` with ack→post-score→follow-up→receipt→resume steps on top of the full live-model run.

**Honest note on live-model e2e flakiness:** re-running the full live discovery conversation a second time, the model legitimately parked the case instead of reaching a candidate (different phrasing led it to judge the story as not-yet-stable) — that's the real non-deterministic nature of an LLM-driven interview, not a bug, and is exactly why the deterministic tests above exist as the repeatable signal while the live run is the supplementary one-time check the brief asks for. Separately hit real Supabase-Auth-login flakiness mid-session that turned out to be a stale Turbopack dev-server state after the `middleware.ts→proxy.ts` rename — a `next dev` restart fixed it immediately and reproducibly; noted here since it could confuse a future session.

61 Vitest + 13 deterministic Playwright tests passing (plus 1 live-model Playwright test that is inherently non-deterministic by design — see slice 5). `tsc --noEmit` and `next build` clean (18 routes).

## ✅ Slice 5 complete — deployed, verified, feature-frozen

**Public production URL: https://evidencefirst-fullstack-mvp.vercel.app** (project `rikkunipuns-projects/evidencefirst-fullstack-mvp`). You ran `vercel login` yourself; I ran `vercel link` + pushed all 9 env vars to Production (values piped via stdin, never printed or logged) + `vercel --prod`.

**Verification caught and fixed two real bugs** (not polish — found while checking the deployment actually works):
1. `.env.local` had a leading space on `NEXT_PUBLIC_SUPABASE_URL` and a trailing space on `OPENAI_API_KEY`. Node's `dotenv` silently tolerated both locally (which is why nothing broke in 4 slices of local testing), but Vercel's env store flagged the trailing-space one explicitly, and it would have shipped a broken `Authorization: Bearer ...<space>` header. Fixed at the source and re-pushed.
2. `NEXT_PUBLIC_APP_URL` was deliberately deferred until the real domain was known, but I deployed once before adding it — `/admin` and `/api/sessions` both 500'd (unhandled throw in `getEnv()`) instead of behaving correctly. Added the var, redeployed, re-verified: `/admin` → 307 to `/admin/login`, `/api/sessions` → 200 with a real DB row and a `Secure` cookie.

**Also added and verified live:**
- `tests/e2e/mobile-layout.spec.ts` (6 tests): no horizontal overflow at 360px/390px, simulated 200% zoom, reduced-motion respected.
- `lib/ai/discovery-pure.ts`: extracted `enforceProvenance`/`neutralFallbackTurn` out from behind `discovery.ts`'s `server-only` import so they're unit-testable; 8 new tests covering the brief's explicit "invalid provenance" requirement (fabricated/partial message-ID citations get nulled; the neutral fallback never fabricates an extraction).
- Ran all 13 deterministic Playwright tests against **both** local dev and the live production URL — 13/13 pass on both.
- Scanned every JS chunk and HTML response actually served by production for the four secret patterns (`sk-proj-`, `sb_secret_`, and the two secret env var names) — zero matches.
- Database left clean: 0 leftover test participants/sessions, 15 seeded evidence units, 3 canonical reversal-QA receipts (trimmed duplicate automated-test runs).

**Final count: 61 Vitest + 13 deterministic Playwright passing (local and production) + 1 inherently-flaky live-model Playwright test documented separately. `tsc --noEmit` and `next build` clean, 29 routes.**

Per your instruction: feature freeze from here — only bugs found during verification get fixed, no further additions.

## Known risks carried from the brief

- Human pilot interviews (Sai Teja, Akhilesh, Anand) must be conducted by the owner — `docs/pilot-script.md` is ready.
- `/admin/evidence` is read-only; toggling a DB row's `enabled` flag does not yet gate delivery composition (documented simplification, delivery reads in-code constants with identical content).
- No separate production Supabase project — same database as local dev throughout this build window.
- 24-hour window: if time runs out, consent/gating/evidence-integrity code ships before export/a11y polish.
