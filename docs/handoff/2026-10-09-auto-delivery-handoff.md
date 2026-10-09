# Removing the mandatory human-review dependency — handoff

Branch `auto-delivery`, built from the currently-deployed commit `f0a6006`.
**Not deployed. Not merged.** 10 commits, all tsc/lint/unit/build-green.

## What this is

A parallel, automatic delivery pipeline (`DELIVERY_MODE=auto`, default in
this branch) that removes the mandatory researcher-approval step for
eligible, classifiable cases, while keeping the existing manual
researcher-review flow fully intact as a fallback (`DELIVERY_MODE=manual`).

## ⚠️ Needs your review before this ships

**`lib/pack-policy.ts`** — the closed claim-kind list per pack, with each
kind's fixed evidence relation (supports/qualifies/contradicts). This is
the thing that decides, deterministically, whether a claim gets delivered
and what relation gets recorded. I drafted it from `lib/evidence.ts`'s
existing scope/boundary/claims text — it is explicitly a draft. A
structural test confirms it's self-consistent (every grounded claim ID is
real, every pack is covered), but **nobody has checked it's the *right*
set of kinds or the right relations.**

## What changed, item by item

1. **Delivery text stays verbatim-only** (confirmed, no code change
   needed) — `composeDelivery` was already pure deterministic composition
   from pack claims + boundary text + the participant's own quoted reason;
   no model call anywhere in that path.
2. **Pack policy table** — `lib/pack-policy.ts` (draft, see above).
3. **Claim classifier** — `lib/ai/claim-classifier.ts` picks one kind id
   from a pack's closed list, or `none`/`unclear`; `validateClassification`
   (`lib/ai/claim-classifier-pure.ts`) is the actual server-side gate — a
   hallucinated id, a different pack's id, or wrong casing always becomes
   `unclear`, never force-matched. One bounded, fixed, neutral
   clarification question on `unclear`; a second `unclear` or `none`
   becomes the exact required message: *"We don't have suitable verified
   evidence for this exact claim."* Never labelled a preference, never
   queued for a human.
4. **Automatic pipeline, no waiting screen** —
   `POST /api/sessions/[id]/auto-deliver` + `AutoDeliveryView` ("Checking
   the available evidence.", bounded clarification/retry). Participant-
   driven steps after delivery (ack, pre/post measurement, receipt,
   follow-up) are untouched.
5. **Atomic, idempotent delivery** — new `auto_deliver_session()` Postgres
   function (SECURITY DEFINER, same pattern as the existing
   `assign_condition`): re-checks withdrawal + expected state + expected
   revision inside the same transaction as the approval insert + delivery
   insert + state transition. Withdrawal-blocks-release is enforced a
   second way too: the existing `deliveries_block_if_withdrawn` trigger
   (from the prior Tier 2 work) applies automatically to this new
   function's insert as well — verified live (withdrawal-before-
   auto-deliver test).
6. **System validation, not a human reviewer record** —
   `approvals.is_system`/`evidence_relation`/`policy_version`/
   `pack_version`/`template_version`/`check_results`, with a check
   constraint enforcing `is_system XOR reviewer_email is not null` — the
   two kinds of record are structurally distinct, never confusable.
7. **`DELIVERY_MODE=auto|manual`**, default `auto` in this build
   (`lib/env.ts`). Manual draft/approve routes now 409 unless
   `DELIVERY_MODE=manual` — no side door.
8. **Honest copy** — consent v2 ("Evidence is selected and checked
   automatically against a fixed set of verified sources — not written
   freely by the AI model. Researchers audit results afterwards.");
   receipt/export report `reviewType` (`automatic`/`researcher`) and
   `claimKind` per delivery. Deliberately did NOT touch WaitingView's "a
   researcher checks every response" — that's still literally true for
   the manual-mode fallback, and auto mode never renders WaitingView at
   all. Also didn't touch the unrelated "Ask for researcher review"
   button (Tier 1's technical-failure recovery screen) — different
   feature, not a claim that every delivery is reviewed.
9. **Resume handling** — `auto-deliver`'s entry states include
   `pending_review`/`approved`, not just `assigned`, so an old
   manual-mode-era waiting session revalidates and resolves (deliver or
   explicit non-delivery) on the next load under auto mode, instead of
   sitting there. No bulk release, no overwritten measurements — each
   session resolves individually, on its own next request.
10. **Admin is inspection/export/post-hoc-flagging only** — draft/approve
    routes 409 in auto mode; new `POST /api/admin/sessions/[id]/flag`
    (any state, never blocks/changes delivery); `SessionTrace` shows the
    automatic decision record read-only when present.

## A real bug found and fixed along the way

`auto_deliver_session()`'s INSERT referenced `approvals.template_version`,
but that column was never added to the `approvals` table in the first
migration — only `draft_revisions` had it. Every real auto-delivery
attempt failed with a Postgres "column does not exist" error until this
was caught by the live e2e run and fixed (migration 0020, additive).
Not caught by unit tests (they don't touch the DB) — this is exactly why
the live-model/live-DB run mattered.

## Database migrations

0018–0020, all additive (new nullable/defaulted columns, one new
function with grants locked to `service_role` from the start). **Applied
to the shared Supabase instance** so the new code could actually be
tested — judged acceptable because nothing currently deployed
(`f0a6006`) reads or writes any of these new columns/functions, so this
has zero effect on whatever's live in production right now (same
backward-compatibility reasoning used for every prior migration this
session). No data rows were touched, nothing was deployed, and I did not
attempt to modify Vercel environment variables (that specific action was
blocked by the permission system when I tried; I stopped rather than
retry or route around it).

## Test results — mocked vs. real-model, reported separately

**Unit (mocked/pure, no network, no DB)** — 104/104 pass, including 19 new
this round:
- `tests/unit/pack-policy.test.ts` (5): structural integrity of the draft
  policy table.
- `tests/unit/claim-classifier.test.ts` (5): `validateClassification`
  never force-matches a hallucinated/cross-pack/wrong-case id.
- `tests/unit/auto-delivery-decision.test.ts` (7): the actual
  deliver-vs-park routing gate, including the defensive "unresolved kind
  never silently delivers" case.
- `state-machine.test.ts` (+1): the new assigned/pending_review/
  approved → delivered/parked transitions, and that they're *not*
  reachable from anywhere else.

**Real-model + real-DB (no researcher login anywhere)** —
`tests/e2e/auto-delivery.spec.ts`, 5/5 pass (4.5 min total):
- (a)+(b) a claim matching a real policy kind reaches delivery, ack,
  measurement (score equal to baseline accepted — nothing forces a
  decrease), and receipt (`reviewType: "automatic"`).
- (d)+(g) an out-of-scope gym-equivalence claim ends discovery-only with
  **zero** claims delivered, the exact required message, never labelled
  a preference.
- (f) refresh after delivery is idempotent (`count=1`, never duplicated).
- (f) withdrawal before auto-deliver blocks it outright (409, zero
  deliveries).
- (c) a genuine preference still parks at discovery, never reaching the
  auto-deliver pipeline — regression check that items 1–6's earlier fixes
  are undisturbed.

**Not live-forced**: (e) "technical failure recovers" — covered at the
unit level only (`validateClassification`/`decideAutoDeliveryOutcome`
both treat any classifier error/hallucination as `unclear`→park, never a
crash), not reproduced by deliberately breaking the live API call. Forcing
a real API failure on demand isn't reliably inducible without mocking,
which would defeat the point of a "real" test.

**Honest gap**: the proven Tier-2 "eligible activity" discovery story
(gym-trip-consistency-motivation) does **not** match any kind currently in
the draft policy table — its natural claim is about personal
motivation/habit, not any of the five activity-pack kinds I drafted. All
five live e2e tests deliberately used an **overridden** confirmed
empirical claim (the participant is always allowed to edit it before
freezing) to target specific, known policy kinds. This is real signal
about the current draft policy's narrowness, not a bug — exactly the kind
of thing your review should weigh in on.

**Not run**: lint/tsc/build were run repeatedly throughout, all green at
the final commit (`ae52300`).

## Remaining before this could ship

- Your review and sign-off on the pack policy table.
- A decision on whether the honest gap above (the proven eligible case
  not matching any drafted kind) means the policy needs broadening, or
  whether that's correctly conservative behavior.
- Vercel `ADMIN_EMAILS` env var was never touched (blocked, not
  attempted around) — the admin-side manual-mode fallback path was not
  re-verified on a live Vercel deployment under this branch (it wasn't
  touched by this branch's changes beyond the new 409 gate, which is
  unit/build-verified but not live-verified against a deployed instance).
- No deploy, no merge, per instruction. "deploy" is your word to give,
  separately for this branch when you're ready.
