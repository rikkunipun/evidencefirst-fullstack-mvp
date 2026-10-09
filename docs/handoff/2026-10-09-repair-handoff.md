# EvidenceFirst repair handoff — 2026-10-09

Status at last update: Tier 1 (items 1–6) complete, verified, and
**deployed to production** at commit `7ac9114` (deploy commit
`55c50f7`). Tier 2 (items 7–11) complete, and now **verified end-to-end
against the real DB and real model** (see "Full local Tier 2 journey
verification" below) — but **not yet deployed**; deploy requires a
separate explicit "deploy" per the task's gate, and should target the
**current commit, not `6e9899b`** — the journey run found and fixed a
real bug (see below) after that commit. Tier 3 not started — see
`docs/deferred.md`. This document is updated in place as work continues;
the final version is the authoritative handoff.

## Full local Tier 2 journey verification (2026-10-09, after `6e9899b`)

Ran the complete participant+researcher journey against the real
Supabase DB and real OpenAI model via `npm run dev` + Playwright (not
mocked), per explicit instruction. Every session marked `is_test=true`
with a `test_run_id` from creation; all test data and the dedicated
disposable test-researcher auth account were cleaned up afterward —
verified zero leftovers.

**Found and fixed a real bug**: `legacyDisposition()` passed
`evidenceRelation: "supports"` straight through to the legacy
`disposition` column, but the DB's `approvals_disposition_check`
constraint only accepts `"supported"` — every real "supports" approval
would have 500'd in production. The unit suite didn't exist for this
function before this run; a unit test now enumerates every
(briefAccurate, evidenceRelation) combination against the constraint's
allowed values (`lib/approval-disposition.ts`,
`tests/unit/approval-disposition.test.ts`).

**Also found**: the OpenAI client had no explicit timeout — the SDK's
~10 minute default let one real call hang for ~11 minutes during this
run. Fixed: `timeout: 20_000` on both OpenAI clients (`discovery.ts`,
`crux-classifier.ts`).

**Results, step by step** (fixed `eligible-activity-flow.spec.ts` — no
longer rotates the real admin's password; new `review-outcomes.spec.ts`):

| Step | Result |
|---|---|
| Participant discovery (real model) | Pass — reaches confirmation |
| Two-field confirmation (item 7) | Pass — decision narrative + empirical claim confirmed separately |
| Eligibility (all 6 gates) | Pass — eligible |
| Baseline freeze | Pass |
| Crux (reason, confirm, hypothetical) | Pass — carries to pre-evidence |
| Pre-evidence + assignment | Pass — condition assigned |
| Researcher login (dedicated test account) | Pass |
| Draft generation | Pass — 5 claims |
| Approval, two required selects, `supports`/accurate | Pass (after the bug fix above) — delivered |
| Delivery has clickable sources + locators | Pass — claim-to-source map populated |
| Post-evidence score + ack | Pass |
| Follow-up link: not-yet-due + early-submit refused | Pass |
| Follow-up link reissue after refresh (item 10) | Pass — old token 404s, new token works, due date unchanged |
| Receipt (frozen belief, both scores) | Pass |
| Resume (fresh GET reproduces state) | Pass |
| `evidenceRelation="outside_scope"` | Pass — terminal refusal, no delivery |
| `briefAccurate=false` | Pass — returns to `assigned` (not refused), fresh draft, then delivers |

One transient login flake during iteration (a brand-new test account's
first sign-in attempt failed once, succeeded on immediate retry) —
not reproduced on the second attempt; not an application bug, no fix
applied beyond noting it.

## Tier 1 production deployment

Deployed from a clean `git worktree` pinned to commit `7ac9114` (not the
working tree, which already had Tier 2 changes in progress by the time
of deploy) via `vercel deploy --prod --yes`, aliased to
`https://evidencefirst-fullstack-mvp.vercel.app`. Pre-deploy: confirmed
migration 0014 is additive-only and that the then-currently-deployed
commit (`13fc858`) is backward compatible with the migrated DB (no
`select("*")` on `sessions`/`extraction_snapshots` in that commit's
queries). Reinstalled deps and reran tsc/lint/71 unit tests/build inside
the pinned worktree — all green.

Post-deploy verification — three fresh sessions through the real public
API, real model, real (migrated) DB:

| Case | Outcome | Turn latency (ms) |
|---|---|---|
| Mixed study story | Follow-up question, then confirmation with a faithful read-back — no misclassification, no blank park | 16196, 13216 |
| Gym/bus story | Same pattern, correct read-back | 15735, 12202 |
| Diagram preference | Parked immediately with the specific "preference/practical/social" reason — correctly still parks | 13292 |

All three confirmed directly against the `sessions` table (state/
park_reason as expected) and marked `is_test=true`,
`test_run_id=tier1-prod-verify-2026-10-09` (audited, not deleted).
Average turn latency ~14.1s end-to-end over the public internet —
higher than the isolated ~10s model-only benchmark, consistent with real
network/region overhead on top of the model's own inference time.

## Tier 2 — what shipped (implemented and verified locally, not deployed)

**Item 7 — decision/claim split.** `belief_confirmations` gains
generated/confirmed decision-narrative and empirical-claim columns
(migration 0015, additive). `ConfirmationView` now shows two separately
editable fields instead of one free-text blob; the server composes the
combined sentence (`combineBeliefWording`) so every existing downstream
reader is unaffected — verified byte-identical via a regression test. An
in-flight session from before this shipped (null split columns) falls
back to best-effort splitting the old combined sentence rather than
losing it. Separately confirmed by code audit (no fix needed): every
score input/display already treats zero as a valid value (`=== null` /
`??`, never a truthy check) across baseline, crux, pre/post measurement,
`ScorePicker`, `ReceiptView`, and export.

**Item 8 — researcher review split.** The approval form asked one
question that defaulted to "Supported" and routed "needs clarification"
into a terminal refusal. Now two required selects with no default
(`briefAccurate`; `evidenceRelation` ∈
supports/qualifies/contradicts/unresolved/outside_scope) — migration
0016 adds `approvals.brief_accurate`/`evidence_relation` (append-only
table unchanged). `outside_scope` terminally refuses (nothing a revision
fixes); an inaccurate brief or `unresolved` evidence relation returns the
session to `assigned` instead of refusing it (new legal transition,
regression-tested to confirm it's *only* legal from `pending_review`) —
"Generate draft" reappears for a fresh attempt. `supports`/`qualifies`/
`contradicts` with an accurate brief all deliver identical content; only
the recorded relationship differs, so a contradicted belief is never
mislabeled as supported.

**Item 9 — free-text topic proposal.** A story with no situation card
left `pack_topic` permanently null, failing the checkable gate regardless
of content. `lib/topic-proposal.ts` is a plain keyword heuristic over the
three real catalog topics — not a model call, deliberately rough, never
guesses without a match. The messages route asks one neutral yes/no
question ("Does your story sound like it's mainly about ___ — yes or
no?") only when `pack_topic` is still null at the point discovery would
otherwise move to confirmation; `pack_topic` is set only on an explicit
yes plus a defense-in-depth `getEnabledPackForTopic` catalog check —
never force-matched. Verified live end-to-end
(`scripts/topic-proposal-check.ts`): a genuine free-text-only gym story
gets asked, answers yes, `pack_topic` becomes `'activity'` before
confirmation.

**Item 10 — follow-up link reissue.** The raw follow-up token is only
ever stored hashed (never recoverable), so a refresh before saving the
link previously said "contact the researcher." New
`POST /api/sessions/[id]/followup-link` generates a fresh token and
overwrites `token_hash` (unique per session, single-row update);
`due_at` is untouched. The DB's pre-existing
`followups_block_update_if_collected` trigger makes reissue impossible
after the follow-up is actually collected, even under a race — the route
catches that and reports `alreadyCollected`. `ReceiptView` now offers
"Get my follow-up link again" instead of a dead end.

**Item 11 — withdrawal atomicity (partial).** Migration 0017 adds a
BEFORE INSERT trigger on both `deliveries` and `measurements` that checks
`sessions.withdrawn_at` inside the same statement as the write —
verified directly against Postgres to reject an insert for a withdrawn
session before any other constraint even runs. This closes the race
where a withdrawal lands between a route's session read and its write,
for the two highest-stakes, participant-visible tables. Double-
measurement was already structurally prevented
(`unique(session_id, phase)` + block-update trigger, pre-existing) — this
only adds the withdrawal check. **Not done**: a full transactional
rewrite of the entire approve-and-deliver sequence as one atomic unit, and
`approvals` writes themselves are not withdrawal-gated (low-harm — never
shown to the participant). See `docs/deferred.md`.

All Tier 2 work: tsc, lint, 82/82 unit tests, and production build pass
after each item; migrations 0015–0017 applied (additive, tracked,
transactional via `scripts/apply-migrations.mjs`). **Not deployed** —
awaiting explicit instruction.

## Confirmed failure cause (not assumed — reproduced live)

`enforceProvenance` (`lib/ai/discovery-pure.ts`) required each
`field_evidence` citation to exactly equal a valid participant message ID.
A live-model repro against the reviewer's exact failing text showed the
model reliably returns citations shaped like `"<id>: \"<quoted
snippet>\""` rather than a bare ID. The exact-match check rejected the
whole string, nulling fields the model had honestly and correctly cited.
With all or most of the six fields nulled, `hasCore` became false while
`stop_reason` stayed `"candidate_ready"`; the route then parked using
`STOP_REASON_MESSAGES.candidate_ready`, which was `""` — and `??` does
not treat `""` as nullish, so neither the server nor `ParkedView`'s own
fallback ever substituted real text. Net effect: an instant, blank park
for factual/mixed stories, independent of whether the story arrived as a
typed opening story or as an answer after a card-only question (confirmed
by the reviewer's third failing case) — consistent with the cause being
in the general extraction/provenance pipeline, not the kickoff path.

## What changed

**Fix, not a workaround**: citation *format* tolerance, not a provenance
bypass. A citation with no real, valid message ID anywhere in it is still
rejected exactly as before.

- `lib/ai/discovery-pure.ts` — `enforceProvenance` now resolves a valid
  UUID embedded in a citation string and normalizes stored evidence to
  the bare ID. Also added: `hasCoreFields`, `isValidationFailure`,
  `mixedDriverNextQuestion`, `MIXED_DRIVER_QUESTION`,
  `MIXED_DRIVER_FOLLOWUP`, `RECOVERY_MESSAGE` — pure, unit-tested, and
  imported directly by the route so there's one source of truth.
- `lib/ai/prompt.v2.ts` (new; `lib/ai/prompt.v1.ts` kept untouched for old
  receipts) — explicit citation-format instruction with a correct/wrong
  example; adds `candidate_driver: "mixed_uncertain"` guidance.
- `lib/zod/discovery.ts` — added `"mixed_uncertain"` to
  `candidateDriverSchema` (additive, backward compatible); bumped its own
  `PROMPT_VERSION` constant to `"v2"` for consistency (this constant is
  otherwise unused elsewhere in the codebase).
- `app/api/sessions/[id]/messages/route.ts` — the core repair:
  - `STOP_REASON_MESSAGES.candidate_ready === ""` entry removed entirely;
    added a `nonEmpty()` guard before any `park_reason` is persisted.
  - A `candidate_ready`-but-core-missing turn (`isValidationFailure`) no
    longer confirms or parks. First occurrence: one bounded repair (a
    neutral missing-field question, reusing the existing per-field
    templates), tracked via `sessions.discovery_repair_used`. Second
    consecutive occurrence: an explicit, persisted recovery state
    (`sessions.discovery_recovery_reason`, fixed wording) — session stays
    in `discovery`, distinct from `parked` in state, admin view, receipts
    and exports.
  - Server-enforced mixed-driver clarification: when the model flags
    `candidate_driver: "mixed_uncertain"`, the route overrides
    `next_question` with the exact spec wording (primary, then its one
    follow-up), regardless of what the model set `should_stop`/
    `next_question` to.
  - Per-phase latency logging (`prepMs`/`modelMs`/`postMs`) added to the
    existing log line.
  - Duplicate `client_token` handling now reports `inFlight` (session
    hasn't moved on and hasn't resolved into recovery either) so the
    client polls/reconnects instead of a one-shot dedupe-and-stop.
  - Structural-only `validation_diagnostics` persisted per extraction
    snapshot (field name, had-value, citation counts, rejected — no
    transcript text).
- `components/participant/DiscoveryView.tsx` — polls on an `inFlight`
  duplicate response (up to 10×2s) before refreshing; renders a distinct
  recovery screen (fixed wording + "Try again" / "Ask for researcher
  review") when `snapshot.session.discoveryRecoveryReason` is set; wait
  copy changed to "Thinking, usually a few seconds."
- `components/participant/ParkedView.tsx` — whitespace-only `parkReason`
  now also falls back to the generic message; "Try a different decision"
  now preserves `?pilot=` via the newly participant-safe
  `snapshot.session.pilotLabel`.
- `components/participant/WaitingView.tsx` — was static; now polls on a
  backoff schedule (5s,5s,10s,15s,30s,60s cap, never stops) plus a manual
  "Check review status" button; cleanup via a mounted ref + `clearTimeout`.
- `app/participate/page.tsx` — situation cards are now explicitly framed
  as optional, plus an equal-weight "Describe my own recent decision
  instead" button (reuses the existing `skip` enum value / `DECISION_CUES`
  entry — no schema change).
- New routes: `POST /api/sessions/[id]/request-review` (participant-
  initiated `needs_researcher_review` flag); `POST
  /api/admin/mark-test` (researcher-authorized, general is_test marking
  by exact session ID — so a pilot label is never the only separation
  mechanism).
- `lib/admin-session-list.ts` + admin sessions list page — recovery and
  review-requested now show as their own badges, never conflated with a
  substantive park in the researcher's own view.
- `lib/ai/discovery.ts` — switched to `prompt.v2`; `enforceProvenance`'s
  new return shape (`{turn, diagnostics}`) threaded through; added
  `reasoning: { effort: "low" }` (see latency section).

## Migration (additive, applied; no backfill needed)

`db/migrations/0014_discovery_recovery.sql`:
`sessions.discovery_repair_used boolean default false`,
`sessions.discovery_recovery_reason text`,
`sessions.needs_researcher_review boolean default false`,
`extraction_snapshots.validation_diagnostics jsonb`. Old rows read as
false/NULL. Applied via `npm run db:migrate` (tracked, transactional,
idempotent — see `scripts/apply-migrations.mjs`).

Tier 2 migrations (all additive, applied):
- `0015_belief_confirmation_split.sql`: `belief_confirmations` gains
  generated/confirmed decision-narrative and empirical-claim columns.
- `0016_approval_disposition_split.sql`: `approvals` gains
  `brief_accurate`/`evidence_relation` (own check constraint); the legacy
  `disposition` check constraint is widened to also allow `contradicts`
  and `outside_scope` — every existing row's value stays valid.
- `0017_withdrawal_consent_guards.sql`: `ef_block_if_session_withdrawn()`
  BEFORE INSERT trigger on `deliveries` and `measurements`.

## Prompt/schema versioning

- `PROMPT_VERSION` for the discovery interviewer: `v1` → `v2`. `v1` file
  untouched; old `extraction_snapshots.prompt_version = "v1"` rows render
  exactly as they did before — nothing reinterprets old rows under the
  new prompt.
- `candidateDriverSchema`: additive enum value (`mixed_uncertain`). Old
  stored values are all still valid members of the enum.
- `confirmBeliefSchema` (new, Tier 2 item 7) replaces the confirm route's
  inline single-field schema; `adminApproveSchema` (Tier 2 item 8) now
  requires `briefAccurate`/`evidenceRelation` instead of one
  `disposition` enum. Both are breaking changes to the *request* shape
  for their routes, but since this app has no real delivered sessions in
  production yet (per the reviewer's own retest), there's no in-flight
  client depending on the old request shape.

## Test matrix

| Case | Path | Expected | Observed | Evidence |
|---|---|---|---|---|
| (a) Mixed study (verbatim) | opening story | clarify/read-back, not auto-park | should_stop=false, hasCore=true, continues | live-model smoke test |
| (b) Factual adult-activity (verbatim) | opening story | read-back then checks | should_stop=false, hasCore=true, asks for the one genuinely missing field (origin_of_expectation) | live-model smoke test + full-route integration check |
| (c) Pure preference (verbatim) | opening story | respectful park, specific reason | stop_reason=no_stable_candidate, candidate_driver=preference_value, validationFailure=false → legitimate nonempty park | live-model smoke test |
| (d) Input path variants | kickoff / after-a-question / free-text-no-card | same outcome regardless of path | fix is in the shared extraction/provenance pipeline, not kickoff-specific code — not independently re-run for all 3×2 path combinations under deadline pressure | reasoned from code path + reviewer's 3rd failing case already crossing paths |
| (e) Invalid extraction (fabricated/missing citation) | any | bounded repair → recovery, never blank | unit-level: `isValidationFailure` true, routes to repair then recovery; route-level repair-then-recovery two-step was NOT independently re-run live (would require forcing the model to fail twice in a row, not reliably reproducible without mocking) | unit tests (discovery-pure.test.ts) |
| (f) Supported-unchanged / zero-score / out-of-scope / duplicate approval / in-flight retry | — | preserved | NOT re-verified today — outside the code paths touched by this repair; existing 61 pre-existing unit tests (assignment/crux/eligibility/delivery/followup/state-machine) still pass unmodified | `npx vitest run` (71/71, includes the pre-existing 61) |

**Honest gaps in the matrix**: (d) and (e)'s route-level two-step repair
were reasoned from code + unit tests, not independently reproduced live
end-to-end for every combination — forcing the *second* consecutive
validation failure live would need a deliberately broken citation, which
isn't reliably inducible from the real model on demand. (f) is a
regression check (existing suite still green), not fresh verification.

## Latency (measured, not guessed)

Isolated benchmark (`scripts/latency-benchmark.ts`, 5 calls/variant, live
model, same case text):
- No reasoning param set (prior production behavior): avg **10461ms**
  (range 9600–11104ms).
- `reasoning.effort="low"`: avg **9960ms** (range 8484–14920ms, one
  outlier).
- `reasoning.effort="minimal"`: unsupported by this model (400 error).

Shipped `effort="low"` anyway (same model, verified no correctness
regression) — but this is a ~5% trim, **not a fix**. The ~10s/turn
latency is dominated by this model's own inference time for this task;
confirmed in code that the happy path makes exactly one model call per
turn (no redundant calls). Targets from the task (~3–5s warm, p95<10s)
are **not met** and are not claimed met. Region alignment (Vercel
functions vs. Supabase's `ap-south-1`) was investigated — Next's
per-route `preferredRegion` is deprecated and now Vercel-only accepts
auto/global/home, so region pinning is a dashboard setting, not a code
change — not done under deadline pressure, and the benchmark suggests it
is at most a minor contributor anyway. A faster compatible model was not
benchmarked (time did not allow); the production model was not changed.

## Test data

`scripts/mark-test-sessions.ts` dry-run (read-only, run locally) confirmed
all 4 known synthetic session IDs exist, are currently `is_test=false`,
carry `pilot_label=synthetic-retest`, and their first participant message
matches each one's expected case description. **Not run with `--apply`**
— production rows are untouched pending the explicit "run the marking"
instruction. General authorized marking path added:
`POST /api/admin/mark-test` (researcher-only, exact IDs, idempotent,
audited, no deletion).

## Remaining blockers / open risks

- Tier 2 (items 7–11) is implemented and verified locally but **not
  deployed** — see "Tier 2 — what shipped" above and `docs/deferred.md`
  for each item's specific remaining scope (e.g. item 11's withdrawal fix
  covers `deliveries`/`measurements` only, not a full transactional
  rewrite of the whole approve-and-deliver sequence).
- Admin session detail page doesn't yet surface `validation_diagnostics`
  or the new `brief_accurate`/`evidence_relation` columns (only the list
  page shows recovery/review badges) — researcher can still query both
  directly in Supabase.
- The repair→recovery two-step and all input-path combinations for cases
  (d)/(e) weren't independently reproduced live end-to-end (see matrix
  note above).
- Tier 1 is deployed and verified on production (3 fresh sessions).
  Tier 2 is not deployed — nothing from items 7–11 is live for pilots
  yet.

## Pilot checklist (3 consenting adults, own recent decisions)

Not run yet — for when pilots start. Measure, per person:
- Ease of finding a decision to describe (did the optional cards help or
  get in the way; did they use "describe my own" instead).
- Faithfulness of the read-back to what they actually said.
- Clarity of why a case was parked (if parked) — specific reason shown,
  not blank.
- Source access on delivery (did the links/locators work).
- Completion (did they reach a receipt or a clear stopping point without
  getting stuck).
- Recovery (if a technical failure occurred, was "try again" / "ask for
  researcher review" clear and functional).
- Confidence changes reported descriptively (before vs. after), with an
  explicit note that **three people cannot show causal persuasion** — this
  is a usability/functionality check, not an efficacy study.
Do not coach participants into "eligible" cases.
