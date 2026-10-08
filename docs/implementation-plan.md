# EvidenceFirst fullstack-mvp — implementation plan

Branch `fullstack-mvp`, worktree of reference commit `f830f11c`. Scope: P0 only (text journey). Deadline 2026-10-09 21:00 IST. See `docs/claude-code-brief.md` for the authoritative spec this plan implements; this file is the execution map, not a restatement.

## 1. Folder structure

```
apps/web/
  app/
    (participant)/
      page.tsx                      -> /
      participate/page.tsx          -> /participate (consent + context)
      s/[id]/page.tsx                -> /s/[id] (single adaptive screen, server-state-driven)
      follow-up/[token]/page.tsx
    (admin)/
      admin/login/page.tsx
      admin/page.tsx
      admin/sessions/[id]/page.tsx
      admin/evidence/page.tsx
      admin/reversal/page.tsx
    api/
      sessions/route.ts                      POST create
      sessions/[id]/route.ts                 GET state
      sessions/[id]/withdraw/route.ts
      sessions/[id]/messages/route.ts        POST discovery turn
      sessions/[id]/confirm/route.ts
      sessions/[id]/eligibility/route.ts
      sessions/[id]/baseline/route.ts
      sessions/[id]/crux/route.ts             action: reason|confirm|hypothetical
      sessions/[id]/pre-evidence/route.ts     also triggers assignment txn
      sessions/[id]/ack/route.ts
      sessions/[id]/measurements/route.ts
      sessions/[id]/receipt/route.ts
      follow-up/[token]/route.ts
      admin/sessions/route.ts
      admin/sessions/[id]/draft/route.ts
      admin/sessions/[id]/approve/route.ts
      admin/sessions/[id]/deliver/route.ts
      admin/evidence/route.ts
      admin/reversal/route.ts
      admin/export/route.ts
  lib/
    env.ts                 zod-validated process.env
    supabase/server.ts     service-role client (server-only)
    supabase/admin-auth.ts researcher session + allowlist check
    state-machine.ts       transition table + guard
    zod/discovery.ts       AI structured-output schema
    zod/requests.ts        every API body/query schema
    ai/prompt.v1.ts        versioned prompt text (PROMPT_VERSION='v1')
    ai/discovery.ts        responses.parse call + provenance validator
    eligibility.ts         deterministic 6-gate engine
    crux.ts                reason loop rules (max 2 passes)
    assignment.ts          permuted-block 1:1 allocator
    evidence.ts            pack loader (ported from dist/evidence-packs.js), word-budget calc
    delivery-template.ts   constrained composition, no free model prose
    receipts.ts            participant + research receipt builders
    capability.ts          random token issuance/verification, HMAC cookie
    audit.ts               audit_events writer
  components/ ...           design primitives (calm light theme per brief §3)
  db/migrations/*.sql
  db/seed.ts
  tests/unit/*.test.ts (Vitest)
  tests/e2e/*.spec.ts (Playwright)
docs/
  implementation-plan.md (this file)
  build-status.md
  pilot-script.md
  submission-evidence.md
  reference-manifest.md
```

One Next.js app, one Supabase project, no microservices, per brief.

## 2. Database migrations & RLS

Tables (see brief §9 for the required invariants each must enforce):

`participants(id, participant_code unique, created_at)` — no name/email.
`sessions(id, participant_id fk, state text, revision int default 0, pack_topic text null, locale, app_version, created_at, updated_at, withdrawn_at null)`
`session_capabilities(id, session_id fk, kind enum[resume,followup], token_hash unique, expires_at, created_at, revoked_at null)`
`consent_events(id, session_id fk, consent_version, consented_at, withdrawn_at null, withdrawal_reason null)`
`context_answers(id, session_id fk, situation_card, goal null, decision_cue null, card_order jsonb, created_at)`
`messages(id, session_id fk, turn_number, role enum[participant,assistant,system], input_mode enum[text,voice], content text, created_at)`
`extraction_snapshots(id, session_id fk, message_id fk, fields jsonb, field_evidence jsonb, candidate_driver, should_stop, stop_reason, safety, prompt_version, model, request_id, latency_ms, error jsonb null, created_at)`
`belief_confirmations(id, session_id fk, revision int, generated_wording, confirmed_wording null, confirmed_at null, superseded_at null)`
`eligibility_evaluations(id, session_id fk, belief_confirmation_id fk, current/specific/causal/consequential/checkable/safe enum[pass,fail,unknown] each, reasons jsonb, rules_version, disposition enum[eligible,parked,pending_clarification], created_at)`
`baseline_snapshots(id, session_id fk unique, belief_wording, scope_time, consequence_text, consequence_evidence, baseline_score int check 0-10, frozen_at)`
`crux_passes(id, session_id fk, pass_number check in (1,2), stated_reason, confirmed_reason null, hypothetical_score int null check 0-10, created_at)` — unique(session_id, pass_number)
`crux_classifications(id, crux_pass_id fk, classification enum[current_claim,near_term_test,distant_forecast,value_identity,unclear], created_at)`
`measurements(id, session_id fk, phase enum[pre_evidence,post_evidence], score int null check 0-10, explanation null, reported_behavior null, recorded_at)` — unique(session_id, phase)
`evidence_units(id, pack_id, pack_version, claim_id, text, source_id, source_title, source_url, locator, evidence_note, tags text[], audit_status, audit_date, enabled bool, created_at)` — unique(pack_id, pack_version, claim_id); **no UPDATE/DELETE grants for any role** — new version = new row.
`assignment_blocks(id, pack_id, pack_version, protocol_version, sequence jsonb, created_at)`
`assignments(id, session_id fk unique, pack_id, pack_version, protocol_version, block_id fk, block_position int, condition enum[fixed,personalized], assigned_at)`
`draft_revisions(id, session_id fk, assignment_id fk, claim_order text[], rendered_text, rendered_html, word_count, content_hash, created_at)`
`approvals(id, draft_revision_id fk, reviewer_email, disposition enum[supported,qualifies,unsupported,needs_clarification], scope_justification, content_hash, approved_at)`
`deliveries(id, session_id fk unique, approval_id fk, exact_text, exact_html, claim_ids text[], source_map jsonb, boundary_text, template_version, content_hash, delivered_at, displayed_ack_at null)`
`followups(id, session_id fk unique, due_at, token_hash unique, collected_at null, score null, reported_behavior null, other_influences null)`
`reversal_runs(id, reviewer_email, pack_id null, submitted_claim, supported bool, matched_claim_ids text[], created_at)` — independent of `sessions`.
`audit_events(id, actor_type, actor_id null, action, entity_type, entity_id null, before jsonb null, after jsonb null, created_at)`

Constraints: CHECK on every score column (0–10); FK from measurements/crux/assignments/deliveries back to the same session; trigger rejecting UPDATE on `baseline_snapshots`, `belief_confirmations.confirmed_wording` once set, `deliveries`, `evidence_units` (immutability by code, not just UI).

**RLS plan:** enable RLS on every table, define **no** client-facing policies (default deny). All reads/writes happen through Next.js route handlers using the service-role key, which bypasses RLS — so every route handler independently re-checks: capability-cookie → session ownership for participant routes; Supabase Auth session + `ADMIN_EMAILS` allowlist for researcher routes. This matches the brief's explicit instruction that service-role bypass makes server authorization mandatory, not optional. Supabase Auth is used only for researcher login; participants never get Supabase sessions.

## 3. State machine

```
consented -> context -> discovery -> confirmation -> eligibility_check
eligibility_check -> parked (terminal)                     [any gate fail/unknown]
eligibility_check -> baseline_frozen -> crux -> pre_evidence_recorded -> assigned
  -> pending_review -> approved -> delivered -> ack_recorded -> measured -> followup_due -> complete
pending_review -> refused (terminal)                        [researcher: unsupported/outside scope]
any non-terminal state -> withdrawn (terminal)
```

`lib/state-machine.ts` holds the transition table as data; every API route calls `assertTransition(session, from, to)` inside the same DB transaction as the mutation, using `revision` as an optimistic-concurrency token (reject stale `revision`). No UI ever infers state; every page fetches `GET /api/sessions/:id` and renders exactly the persisted `state`.

## 4. AI schema & prompts

`lib/zod/discovery.ts` encodes the contract from `AI_Adaptive_Interviewer_Contract_V3.md` §"Required structured output" as a Zod object (nullable extraction fields, `field_evidence` arrays of message IDs, `candidate_driver`, `should_stop`, `stop_reason`, `safety`). Parsed via OpenAI Responses `responses.parse` with `zodTextFormat`, model from `OPENAI_TEXT_MODEL`, `store: false`.

`lib/ai/prompt.v1.ts` is the versioned system prompt (skeleton from the contract doc, §"Prompt skeleton"); every audit row stores `prompt_version='v1'`, `model`, request id if the SDK exposes one, latency, and error metadata.

`lib/ai/discovery.ts` after parsing: (1) validates every non-null field's `field_evidence` message IDs exist in this session and were part of the input turns (provenance, not truth); (2) drops/`null`s any field without valid evidence; (3) enforces the 25-word question cap; (4) increments the **displayed**-question counter (not retries) against the budget of 8; (5) on schema/parse failure, retries once, then falls back to a logged neutral template question and marks the turn `fallback: true` — never silently presented as a successful model turn.

## 5. Eligibility, crux, scores

`lib/eligibility.ts` is pure, deterministic, unit-testable: given confirmed fields + any clarification answers, returns `{current, specific, causal, consequential, checkable, safe}` each `pass|fail|unknown` plus reasons. `unknown` never passes. Any non-`pass` → `parked` with the specific reason shown to the participant in plain language.

`lib/crux.ts` enforces: ask main reason → reflect → confirm → hypothetical score; if hypothetical ≥ baseline, allow exactly one more participant-supplied reason, then stop regardless of outcome. Classification is one of the five enum values; only `current_claim`/`near_term_test` + confirmed importance + confidence drop + checkable-via-enabled-pack can proceed to `pre_evidence_recorded`.

Three real score phases persisted: `baseline`, `pre_evidence`, `post_evidence` (in `measurements`/`baseline_snapshots`). Hypothetical crux scores live only in `crux_passes`, never copied into `measurements`.

## 6. Assignment, evidence, delivery

`lib/evidence.ts` ports `dist/evidence-packs.js` claims verbatim into the `evidence_units` seed (3 packs × 5 claims, exact text/source/locator/tags) — see §7 of the brief. `selectClaims` logic becomes `protocol: order_personalization_v1`: fixed = canonical order; personalized = same 5 IDs sorted by tag overlap with confirmed reason, stable tie-break on claim ID.

`lib/assignment.ts`: on first successful `pre-evidence` transaction, if no `assignments` row exists for this session (idempotency check inside the same transaction/lock), consume the next unused position in a persisted permuted block (`assignment_blocks`, generated with Node `crypto.randomInt`-based Fisher-Yates per pack/version/protocol the first time it's needed) and insert the assignment row. Retries re-read the existing row instead of reassigning.

`lib/delivery-template.ts`: output is **only** an ordered list of approved claim IDs + fixed boundary text + a small set of versioned connective templates + escaped participant-reason quotation — never free model prose. Word budget computed from the actual imported claim text, documented once, asserted equal between conditions in tests.

Delivery commit: single transaction that re-checks consent/not-withdrawn, crux pass, scores present, assignment, approval hash match, evidence versions still enabled, and current `state`, then writes the immutable `deliveries` row before the API responds. `ack` endpoint records `displayed_ack_at`; `measurements(post_evidence)` is rejected until `displayed_ack_at` is set.

## 7. Participant & researcher routes

Listed in §1 above; matches brief §10 exactly (`/`, `/participate`, `/s/[id]`, `/follow-up/[token]`, `/admin/*`). Capability tokens: 256-bit random, stored only as SHA-256 hash, exchanged for an HttpOnly `__Host-session` cookie scoped to that session id; follow-up tokens are a separate, narrower capability (read + one-time submit on `followups` row only).

## 8. Testing strategy

**Vitest** (`apps/web/tests/unit`): each eligibility gate fail/unknown case; crux two-pass cap; assignment determinism + balance across a simulated block; claim-count/word-budget equality fixed vs personalized; evidence immutability (DB-level, via a throwaway test schema or mocked repository); follow-up due-date = delivery + 7d exactly; Zod schema rejection of malformed AI output; provenance rejection of fabricated message IDs.

**Playwright** (`apps/web/tests/e2e`), OpenAI calls mocked via a test double behind `lib/ai/discovery.ts`'s interface: eligible activity run end-to-end; discovery-only parked run; unsupported-domain/reversal refusal; refresh mid-session resumes exact state; researcher login → approve → deliver; post-measurement; follow-up not-yet-due vs due. One manual, explicitly-labelled live-model smoke test is run outside CI and reported separately (brief requires distinguishing mocked vs real-provider checks).

Existing `node --test tests/evidence-packs.test.cjs` on `main`/`dist` stays untouched and green.

## 9. Environment variables

```
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_PASSWORD=
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=
ADMIN_EMAILS=
SESSION_TOKEN_SECRET=       # HMAC key for capability-cookie signing (new; brief allows "any required session secrets actually used")
```
Validated at boot by `lib/env.ts` (Zod); missing provider credentials fail with an honest config error, never a fabricated interview.

## 10. Deployment steps

1. `supabase link` + `supabase db push` (or run SQL migrations directly) against the real project already configured in `.env.local`.
2. `npm run seed` (dev-only script) to load the 3 evidence packs + assignment-block scaffolding.
3. `vercel link` → set the same env vars (minus `NEXT_PUBLIC_*` stay public) in the Vercel project → `vercel --prod`. Requires the owner to run `vercel login` interactively (OAuth) since I cannot complete that flow; everything else is scriptable.
4. Verify the public URL from a clean browser: consent → real model call → refresh/resume → admin login → approve → deliver → receipt.

## 11. Risks & explicitly deferred

- **Deferred (per brief §2/§12):** voice input, >3 packs, reason-matched (non-order) personalization, email reminders, CSV export, large dashboards, native apps.
- **Risk:** Vercel/Supabase cloud deploy needs the owner's interactive login — code/migrations/tests will be complete and committed regardless; deployment itself is reported as blocked until that happens, not claimed done.
- **Risk:** Human pilot interviews (Sai Teja, Akhilesh, Anand) must be conducted by the owner, not by me; I prepare `docs/pilot-script.md` only.
- **Risk:** 24-hour window. If time runs out, P0 slice order (this doc §1 "Slice" tasks 1–5) is prioritized so that whatever lands last is export/a11y polish, never consent, gating, or evidence integrity.
