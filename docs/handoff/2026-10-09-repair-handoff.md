# EvidenceFirst repair handoff — 2026-10-09

Status at last update: Tier 1 (items 1–6) complete and verified. Tier 2/3
not started — see `docs/deferred.md`. This document is updated in place
as work continues; the final version is the authoritative handoff.

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

## Prompt/schema versioning

- `PROMPT_VERSION` for the discovery interviewer: `v1` → `v2`. `v1` file
  untouched; old `extraction_snapshots.prompt_version = "v1"` rows render
  exactly as they did before — nothing reinterprets old rows under the
  new prompt.
- `candidateDriverSchema`: additive enum value (`mixed_uncertain`). Old
  stored values are all still valid members of the enum.

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

- Tier 2 (items 7–11) not started: empirical-claim/decision separation,
  researcher supports/qualifies/contradicts/unresolved/outside-scope
  review, free-text topic proposal, follow-up link recovery, transactional
  consent/approval/delivery/measurement writes.
- Admin session detail page doesn't yet surface `validation_diagnostics`
  (only the list page shows recovery/review badges) — researcher can
  still query it directly in Supabase.
- The repair→recovery two-step and all input-path combinations for cases
  (d)/(e) weren't independently reproduced live end-to-end (see matrix
  note above).
- No deploy has happened. Nothing here is live for pilots yet.

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
