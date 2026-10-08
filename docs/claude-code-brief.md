# EvidenceFirst — complete Claude Code implementation prompt

Copy this entire document into Claude Code. It directs implementation; it does not claim the full-stack application already exists.

---

You are implementing EvidenceFirst, an AI-assisted, source-gated research MVP for a capstone. Build and test a working full-stack application. Continue beyond planning into implementation. Make routine engineering decisions yourself; ask only for genuinely missing credentials, access, or requirements that block dependent work. Continue independent work while blocked.

The submission deadline is **9 October 2026 at 9:00 PM Asia/Kolkata**, equivalent to **2026-10-09T15:30:00Z**. Check the actual current time and adjust your work accordingly. Prioritize a complete deployable text journey. Do not treat the deadline as permission to weaken consent, authorization, evidence boundaries, or measurements.

## 1. Inspect and preserve the reference

Canonical repository:

`/Users/nipunrikapu/Documents/Codex/2026-09-13/for-the-context-there-is-a/siddhant-mvp-v1`

Reference commit:

`f830f11c1b9e870c8edd18fbb9a9b1512ee8a293`

Reference documents directory, called `HANDOFF` below:

`/Users/nipunrikapu/Documents/Codex/2026-10-08/evidencefirst-handoff-8-october-2026-deadline/outputs`

Before editing, inspect applicable AGENTS.md instructions, Git status/history/remotes, installed runtimes, existing configuration, source files, tests, and these documents:

- `HANDOFF/EvidenceFirst_V3_4_Audit_and_Handoff.md`
- `HANDOFF/EvidenceFirst_V3_Product_Requirements.md`
- `HANDOFF/Belief_Discovery_Protocol_v3.md`
- `HANDOFF/AI_Adaptive_Interviewer_Contract_V3.md`
- `HANDOFF/Adaptive_Crux_Implementation_Oct8.md`
- Repository `dist/index.html`, `dist/evidence-packs.js`, `tests/evidence-packs.test.cjs`, and README.

The audit records software validation, not scientific validation of persuasion or the interview method. V3.4 remains a static local-storage prototype. It lacks a real model endpoint, durable sessions, authenticated approval, server assignment, and follow-up collection. Its five example QA sessions are synthetic. Its reported Site publication was not updated to the tested commit. Inspect current facts rather than assuming any remote or live deployment matches the local reference.

Treat this prompt as the implementation direction where it explicitly revises older documents, particularly the picker, experimental condition scope, P0 follow-up, and visual design. Preserve the measurement and evidence safeguards. Document unresolved conflicts instead of silently changing the protocol.

Create branch `fullstack-mvp` from the reference commit without resetting, discarding, or overwriting anyone's work. If that branch already exists, inspect and continue its relevant implementation. Use a separate worktree if needed to preserve an active checkout. Put the application in `apps/web/` on this branch. Keep the reference `dist/` and existing tests unchanged. Preserve the reference commit and a checksum manifest of its two evidence/prototype files. Do not migrate private participant receipts into Git or public assets.

If the absolute paths are unavailable on the executing machine, locate the supplied repository and documents. The source ZIP in HANDOFF is a fallback reference. Report missing necessary inputs precisely; do not recreate evidence from memory.

## 2. Build scope and stack

Use Next.js App Router, TypeScript, Tailwind CSS, Supabase Postgres, Supabase Auth for researchers, Zod, server-side OpenAI Responses API, Vitest, Playwright, and Vercel. Use compatible maintained versions, verify their current official setup guidance, and commit a lockfile. Do not copy obsolete SDK examples or pin a model based on memory.

Use one application and database, without microservices, queues, generic chat, or live evidence search. Normal browser storage is not the authoritative research record. Build a real server/database path; a polished frontend with mocked production persistence does not meet P0.

P0:

- Light, responsive participant application and distinct authenticated researcher routes.
- Consent, AI disclosure, seven situation cards plus other/skip, optional goal, neutral decision cues, and free text.
- Adaptive text discovery, participant corrections, deterministic checks, and max-two-pass participant-supplied crux loop.
- Three separately observed confidence scores, immutable snapshots, durable sessions, and refresh/resume.
- Three imported audited packs, scoped review, two honestly described conditions, and server assignment.
- Authenticated researcher approval, safe exact delivery, post-measurement, downloadable JSON receipts.
- Researcher reversal QA, source map, compact audit log, and basic de-identified JSON export.
- Seven-day due date and a working capability-protected follow-up page; no email service required.
- Meaningful tests, production build, deployment configuration, and public Vercel verification when access exists.

P1 only after P0 passes: editable speech transcripts, email reminders, CSV/analytics, extra researcher notes, larger audited libraries and reason-matched subsets. P2 defer: real-time voice, autonomous evidence research, many domains, multilingual support, native mobile apps, elaborate roles, large dashboards. A minimal authenticated researcher allowlist is P0, not an advanced-role feature.

## 3. Participant experience and redesign

Completely redesign the participant interface. Do not copy the static dark dashboard. Use a calm white/light-grey page, a centered column about 720px wide, readable dark-slate text, restrained teal/emerald accents, subtle borders, generous spacing, and one primary action per screen. Fresh emerald can be decorative; use a sufficiently dark button color for white text. Choose accessible color combinations rather than assuming the proposed palette meets contrast requirements.

Use at least 16px input text, visible keyboard focus, semantic labels, errors associated with fields, sufficiently large touch targets, and reduced-motion support. Verify 360px, 390px, and desktop layouts, long participant answers, and 200% zoom. Avoid gradients, neon, glass effects, crowded forms, and long chat walls. Display the current question prominently with a collapsible previous-conversation view. Never show an invented percentage or fixed question count when adaptive discovery can end early.

Use seven broad progress stages: start/context; recent decision; confirm/check; belief/reasons; review; sources/reaction; receipt/follow-up. These are UI groupings; server states can be finer.

The user reported that student topic cards took too long to choose and did not match their life. Fix retrieval before adding AI:

1. Ask “Which sounds most like your situation right now?” Keep the seven roles, allow other and skip, and do not infer age or beliefs from the choice.
2. Optionally ask “What goal or responsibility is taking most of your attention this month?”
3. Ask about one decision from the past two weeks. Show a small set of relevant neutral examples, approximately four to six initially, with “More examples” and “Something else.” Allow starting directly with free text.

Student cues might be “How I prepared for a recent test,” “A course or skill I tried or skipped,” “How I used study time,” “An activity I fitted into my week,” and “A purchase I considered.” They must describe events, not suggest an incorrect belief. A purchase can legitimately become discovery-only. Keep cue order stable within a session; if shuffled, store that order. Do not optimize for misconception yield or confidence decrease.

Role and topic are context, not eligibility or evidence authorization. Selecting “study” must never automatically authorize an exam-performance claim. Unsupported areas must still offer a respectful discovery conclusion.

Use plain participant language: “Let’s understand what happened,” “What mattered most in your decision?” and “Have I understood your view correctly?” Keep labels such as crux, condition assignment, six gates, and verifier in the researcher interface.

## 4. Consent and access

Before any model call or interview storage, obtain explicit consent and record its version and server timestamp. Explain AI assistance, what text/measurements are stored, that relevant answers are sent to the model provider, researcher access, and how to stop. Do not claim zero provider retention merely because API response storage is disabled. State an actual configured retention policy; do not promise automated deletion unless implemented. Collect no names or email by default.

P0 recruitment is adults 18+ only. Do not infer adulthood from a role. Decline minors unless a separately approved guardian-consent/assent protocol exists. A child-study topic can concern an adult's decision; it does not authorize interviewing a child.

Allow stop/withdraw, persist the disposition, cancel pending delivery, and prevent subsequent model calls or research measurements after withdrawal. Explain the implemented data-removal/contact procedure honestly. Keep this distinct from normal immutable research snapshots.

Participants need no account. Use cryptographically random resume capabilities, store only token hashes, and exchange capabilities for secure HttpOnly cookies where appropriate. IDs alone never grant access. Treat resume/follow-up links as secrets; redact them from logs/exports, avoid third-party trackers, set no-referrer handling, and prevent shared caching of private responses. Follow-up capabilities must have narrower permissions than session/researcher access. Document expiration and recovery limits.

Researchers use Supabase Auth with a verified server-side allowlist. Authenticate and authorize every researcher API mutation and read, not just the dashboard layout. Participants cannot approve, alter conditions, inspect other sessions, or invoke researcher reversal endpoints. Enable RLS and least privileges for all sensitive tables. Service credentials remain server-only and bypass RLS, so server authorization is mandatory too. Test unauthenticated, wrong-role, and cross-session requests.

## 5. Adaptive discovery and model boundary

Use a versioned prompt and strict Structured Outputs contract based on the interviewer document. Reconcile field names into one shared Zod schema. Include nullable extraction fields for action, real alternative, expected outcome, origin, actual consequence, consequence evidence, scope/time, candidate belief/reason, and uncertain driver classification. Include `mixed` and `unclear` classifications. A question may be null when discovery is complete.

Every non-null extracted field requires participant message IDs and supporting verbatim spans. Validate that referenced messages belong to this session, were supplied as model input, and contain the quoted spans. These checks establish provenance, not semantic truth; participant read-back and researcher review resolve interpretation. Preserve raw answers separately. Participant edits become new attributed messages/events.

Call the OpenAI API only on the server. Use the current official SDK's Responses Structured Outputs support, such as `responses.parse` with `zodTextFormat` under `text.format`, and validate parsed content and business constraints. Read the model from `OPENAI_TEXT_MODEL`, use `store: false`, bound output/context/latency, and handle refusals, incomplete outputs, malformed proposals, and provider failures. Structured JSON is not proof of a correct extraction.

Send the most recent turns, relevant cited participant excerpts, current confirmed fields, next missing field, budgets, safety flags, and prompt/schema versions. Treat participant text as untrusted data, never as system instructions. Do not expose model tools for database mutation or browsing. Log request/model/prompt/schema versions, latency and failure metadata without leaking credentials or duplicating personal text into application logs.

The model can propose one neutral question of at most 25 words, summarize, and propose extractions/classifications. It cannot assign eligibility, consent, scores, condition, timestamps, freezing, pack authorization, approval, delivery, receipts, or follow-up dates. Reject invented IDs, scores, confirmations, or authority claims.

Application code owns an eight-question discovery budget. Count questions actually displayed, not provider retries. Context, read-back, and bounded crux/measurement steps have distinct recorded counters; do not use clarification as a loophole for unlimited discovery. Skip questions already answered. Use at most one bounded schema/content repair attempt, then a logged neutral template fallback or a retry state. Do not repeatedly consume provider calls or the participant's question budget. A fallback must be labelled internally and cannot pretend to be a successful model turn.

Discover a recent event, chosen action, genuine available alternative, expected result, origin, decision driver, and actual consequence/evidence. Ask observable details before explanations. Never manufacture candidate beliefs or reasons. Do not conduct therapy or pursue distress, trauma, eating behavior, addiction, politics, religion, identity, or individualized medical/legal/financial persuasion.

Interpersonal conflict is not automatically social conformity. “Stress” alone is not verified health damage. Preference, resource constraints, future-only claims, missing costs, unclear drivers, and unsupported domains can legitimately end the interview. If the story becomes mixed, clarify neutrally or park rather than classifying confidently.

## 6. Confirmation, deterministic eligibility, and crux

Show an editable read-back: “I chose [action] instead of [alternative] because I expected [outcome].” Require explicit participant confirmation. Store generated and participant-confirmed wording separately. Changing context before confirmation clears stale draft fields; after freezing, corrections create a superseding revision with renewed downstream checks.

Represent each eligibility gate as `pass`, `fail`, or `unknown`, with supporting participant answers, evidence status, and rules version:

- Current: the participant still holds the expectation.
- Specific: action, alternative, expected outcome, scope, and time are established.
- Causal: the expectation materially affected the choice.
- Consequential: an actual past money/time/health consequence and concrete support are established.
- Checkable: the exact claim/reason can be addressed by approved evidence or a feasible test.
- Safe/in scope: the case meets exclusions and the delivery domain boundary.

Server rules evaluate explicit confirmations and recorded structured requirements. Do not pretend a string-presence check verifies causality, health effects, source entailment, or truth. Ambiguity requires participant clarification or researcher adjudication; unknown never passes. A participant's concrete report must be labelled self-reported unless corroborated. Do not invent verification, uploads, costs, diagnoses, or records.

Park any failed/unknown case with a useful plain-language explanation and receipt. For cases parked before baseline, belief scores, assignment, claims, and delivery timestamps remain null/empty. If parking happens later, preserve measurements actually collected while leaving unobserved ones null.

For a qualified candidate, confirm the exact belief and collect an explicit integer 0–10 baseline with no default. Freeze a versioned belief/consequence/scope snapshot and baseline before testing reasons.

Ask for the participant's main reason, reflect it, and require confirmation. Then ask “Suppose that reason turned out not to be true. What would your confidence be, from 0 to 10?” Store this hypothetical score separately from real confidence observations.

If hypothetical confidence does not fall below baseline, allow one other participant-supplied reason and repeat once. Never pressure a lower score; stop after two passes. A provisional crux requires participant-confirmed importance, a decrease in hypothetical confidence, and checkability. Classify it as current claim, near-term test, distant forecast, value/identity, or unclear. P0 delivers only when the audited pack actually addresses it. A personal prediction requiring a future experiment can be parked/test-pending; general sources must not settle an unperformed personal test.

After crux elicitation, explicitly collect a fresh **pre-evidence score**. After delivery, explicitly collect a **post-evidence score**, reaction, and intended action. The three actual score phases are baseline, pre-evidence, and post-evidence. Hypothetical crux scores are a fourth kind of data, not a measurement phase. Missing stays null; zero stays zero; do not use truthy fallbacks or sliders initialized at eight.

Store review/waiting durations. Do not call baseline-to-post change the evidence-only effect. Report pre-evidence-to-post change separately from baseline-to-pre-evidence change, with explanations and no automatic lower-is-better interpretation.

## 7. Evidence library and honest experiment scope

Import the exact approved text, source metadata, locators, evidence notes, boundaries, tags, audit dates, and versions from V3.4:

- Activity 2.0: C1, C2, C3, C4, C6.
- Study 1.0: S1–S5.
- Learning-style matching 1.0: L1–L5.

Preserve caveats and the newer positive learning-style finding. No guaranteed gym equivalence, personal adherence, exam marks, individual learning outcome, or dismissal of valid format/accessibility preferences. Discovery topics outside these packs never receive a factual persuasion brief. Do not add packs for this deadline.

Evidence records are immutable versions, keyed by pack/version/claim ID. Future edits create a new version; historical receipts retain copied claim/source snapshots. An exact approved claim match proves library membership, not that it answers this person's belief. Require human scope review of the frozen belief **and confirmed reason** before delivery.

There are only five approved claims in each existing pack. Implement protocol `order_personalization_v1` for P0:

1. Fixed brief: the pack's same canonical five claims in the same order for every session in that pack version.
2. Personalized ordering: the same five exact claims, sorted by a documented deterministic relevance rule using the confirmed reason, with stable tie-breaking.

Store matched tags/ranking and protocol version. These conditions compare ordering, not different evidence subsets or arbitrary AI-written persuasion. Keep the same interface, claim text, mandatory boundaries, and word budget. Do not make the fixed arm deliberately harder to read. Do not fabricate five new claims to create a stronger comparison.

If reason-matched subset selection is required later, it requires a separately audited larger library and a new experiment version. Defer it and state this limitation explicitly. Never silently relabel order personalization as full personalized evidence selection.

Set claim count to five. Calculate real word budgets from imported claim text and required approved boundary text; document the counting rule. Do not inherit an arbitrary minimum that requires filler. Both conditions should have identical substantive content and total word count for a given pack. Store counts in receipts and test them.

Assign eligible, crux-qualified sessions server-side once, using persisted 1:1 permuted blocks within pack/version and protocol version. Create and store shuffled block sequences with server cryptographic randomness and allocate under a database lock/transaction. Store allocation sequence, block position, and algorithm version privately. Reproducibility means the stored sequence reproduces each allocation, not guessing assignment from a public session ID. Retries cannot reassign. Partial blocks and rejected/withdrawn sessions can produce unequal delivered counts; retain assignments and report exclusions without reallocating them to manufacture balance.

## 8. Researcher review, safe editing, and exact delivery

Implement a small light dashboard with a queue and session detail. Show transcript provenance, candidate/confirmed fields, gates and reasons, cost status, all scores, crux passes, condition, pack version, source links/locators, exact proposed response, approval history, delivered receipt, and follow-up status.

Review outcomes are supports, qualifies/contradicts, unsupported/outside scope, or needs clarification. Supported evidence preserves the participant's view. A correction is allowed only when scope review supports it. Review is bounded source checking, not automated proof or a declaration that every participant is wrong.

P0 evidence rendering must be constrained composition: approved claim IDs in a validated order, approved boundary text, escaped participant quotation, and a small set of versioned non-factual templates. Do not deliver arbitrary model prose or raw researcher HTML. “Edit” controls may reorder/select valid units within protocol limits and edit labelled participant reflection; they cannot introduce unreviewed factual text. Editing an approved draft invalidates its approval. Editing the fixed substantive brief requires a new protocol/brief version rather than session-specific drift.

Approval records authenticated reviewer ID, disposition, scope justification, draft revision/content hash, pack/version/claim versions, and server timestamp. The delivery transaction rechecks all gates, consent, crux, scores, assignment, active evidence versions, approval hash, and state. Reject stale approvals and concurrent edits. A parked/rejected/withdrawn session cannot be resurrected by back-navigation or an API call.

Commit the immutable delivery snapshot before returning it to the participant: exact plain text, safe rendered content, ordered claims, source map, boundary/reflection text, template version, hash, approver, and timestamp. Render from that snapshot forever; no regeneration on refresh. Record delivery commitment separately from first-display acknowledgement, and require actual display acknowledgement before post-score submission. A persisted message is not proof that the participant read it. Retries produce one delivery and one observed measurement per phase.

For unsupported reversal QA, allow an authenticated researcher to submit an overbroad assertion such as “Walking guarantees the same results as any gym programme and guarantees I will stick with it.” Refuse because it has no authorized support; emit a refusal receipt and zero delivered evidence claims. Keep this separate from real participant sessions and experiment denominators. An exact approved text membership lookup must also work. Do not let exact matching masquerade as semantic verification of arbitrary wording.

## 9. Database, state, receipts, and follow-up

Create reproducible Supabase migrations, indexes, constraints, RLS, restricted transactional functions, and idempotent evidence seed scripts. Suggested records: sessions/capabilities, consent events, messages/extraction proposals, confirmation/belief revisions, eligibility evaluations, crux passes, measurements, allocation blocks/assignments, immutable evidence versions, draft revisions/approvals, deliveries, follow-ups, reversal QA, and audit events. Use a simpler schema if it preserves the same invariants.

Scores need database bounds and phase uniqueness. Add foreign keys tying measurements/approval/delivery to the same frozen belief/session. Enforce immutability for frozen snapshots through database constraints/triggers and restricted mutations, not disabled UI alone. Service-backed normal operations must not overwrite frozen facts. Administrative retention/removal is a separate documented operation, not a claim that data can never be deleted.

Define legal transitions centrally, for example:

`consented → context → discovery → confirmation → eligible → baseline_frozen → crux → pre_evidence_recorded → assigned → pending_review → approved → delivered → measured`

Permit documented pending-clarification states, and terminal parked/refused/withdrawn states at valid points. Follow-up is a related measurement lifecycle, not permission to repeat delivery. Every mutation validates authorization, expected state/revision, input schema, and an idempotency key. Use optimistic concurrency and transactions/RPCs for allocation, approval, delivery, and measurement. Do not hold a database transaction open across an external model call. Attach the result only if the session revision still matches.

Store UTC timestamps from the server/database. Display local dates in Asia/Kolkata where relevant. Refresh/render/export never changes timestamps. Follow-up due time is exactly delivery commitment time plus seven days. Implement a scoped follow-up link and page that repeats the exact frozen belief and collects explicit confidence, reported behavior, and other influences at/after due time. Before due, show “not yet due” without inventing observations. Store early/late timing honestly if a future protocol permits it. No automatic emails or scheduling service are required for P0.

The participant receipt should show frozen wording, explicit score phases, sources, outcome/disposition, and their follow-up link. Their authenticated JSON download can include their own detailed receipt. Researcher exports must be de-identified and omit capabilities, credentials, contact data, and raw sensitive transcripts by default.

Research receipts include schema/app/prompt/model/protocol/rules versions, participant code, consent, exact confirmation and provenance, gate results, established/self-reported consequence status, baseline/hypothetical/pre/post scores, assignment, pack and claims/source snapshots, drafts/approval, exact delivered text/rendered content/hash, timestamps/exposure acknowledgement, errors, reactions, follow-up state and audit references. Undelivered/unobserved fields remain null or empty. Repeated exports of frozen facts must match; current follow-up status may legitimately evolve.

## 10. Routes, configuration, and operational behavior

Provide `/`, `/participate`, `/s/[id]`, capability exchange/resume, protected participant receipt/download, `/follow-up/[token]`, `/admin/login`, `/admin`, `/admin/sessions/[id]`, `/admin/evidence`, `/admin/reversal`, and protected export endpoints. Participant and researcher API authorization must be independent of route names. Use private response DTOs rather than exposing whole database rows.

Create `.env.example` with descriptions and no real values:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=
ADMIN_EMAILS=
```

Add any required session/experiment secrets and limits actually used. Never expose secrets with NEXT_PUBLIC prefixes. Document server-only keys, approved researcher setup, Auth redirect URLs, local and hosted migrations, seed commands, token expiry, and consent/retention configuration. Verify current Supabase key conventions rather than renaming credentials blindly.

Show saving/saved/error states, recoverable provider failures, empty researcher queues, pending review with manual refresh or modest polling, lost-connection retry, invalid/expired links, and park/refusal receipts. Apply input-size limits and persistent rate limits to anonymous creation/model endpoints; no unbounded public API-spend surface. Do not rely solely on in-memory counters in serverless production. Missing provider credentials must produce an honest configuration error, not a fabricated successful AI interview. Mocks belong only in tests/development.

Keep existing Sites static hosting configuration intact. This new application targets a separate Vercel project with root `apps/web`; do not attempt to publish it as the reference static Site. Never print secrets, commit .env files, or expose private participant data in screenshots/submission assets.

## 11. Implementation order and tests

Write a short `docs/implementation-plan.md` and acceptance matrix, spending at most 20 minutes on planning. Implement immediately in vertical slices:

1. Scaffold, light design primitives, database migrations/seed, researcher auth, participant capabilities and consent.
2. One real model-backed discovery path through confirmation, gates, freezing, crux and pre-evidence score.
3. Server assignment, source-scoped researcher review, constrained delivery and immutable receipt.
4. Post-measurement, refresh/resume, parked/refusal paths, follow-up link/collection and basic export.
5. Critical tests, mobile/accessibility fixes, production setup/deployment and demo evidence.

Commit coherent tested slices. Maintain `docs/build-status.md` with done, incomplete, blocked and deferred items. Never stop after generating architecture, mockups, fake dashboards, or placeholder endpoints.

Run existing reference evidence tests and meaningful new Vitest/unit, database integration, and Playwright checks:

- Missing versus zero scores at every phase; hypothetical scores never become real observations.
- Consent absence, withdrawal, eight-question budget, max two crux passes, skipped answered fields, invalid provenance, mixed/unclear stories, provider refusal/timeout/injection.
- Every failed/unknown gate; no actual cost; supported belief preserved; no inference that emotion or conflict establishes illness/conformity.
- Unsupported topic/claim and researcher reversal produce no factual delivery or experiment assignment where inappropriate.
- Immutable evidence versions, exact pack imports, equal five-claim/word budgets, fixed-brief stability, reason-ordering tie-breaks and no new factual text.
- Persisted blocked assignment, duplicate/concurrent requests, stale approvals, direct API bypass attempts, and frozen database mutation rejection.
- Unauthorized admin access, cross-session participant access, privileged-key absence from client bundles, protected exports and RLS denial.
- Exact approved snapshot shown after refresh/restart; recorded-but-not-displayed delivery cannot submit post-score.
- Full eligible activity journey; discovery-only parked purchase; supported learning-style case; eligible study case with second crux pass; separate unsupported reversal.
- Seven-day due timestamps, early follow-up denial, due collection and duplicate protection using a test clock/fixture only outside production.
- Real database persistence after server restart and browser refresh; JSON download; source link metadata and mobile layouts.

Use a separate test database/namespace and clearly labelled synthetic fixtures. Test with mocked model responses for repeatability, then perform at least one consented or explicitly synthetic end-to-end live-model check against the real server/database. Report which checks used mocks and which used the actual provider. Do not claim mocked AI tests validate actual interviewing quality.

Run lint, TypeScript checks, tests, database integration checks, critical browser tests, and a production build using documented scripts. Fix material failures before deployment. If a required tool/service is unavailable, record the exact unrun check and continue other work; do not change it to passed.

## 12. Deployment, human pilot, and definition of done

Prepare Vercel configuration and fresh Supabase setup from migrations/seed. Deploy when authorized account/project access is available. Use the supported deployment path, preserve the static reference, and never bypass access or approval failures. If secrets/access are missing, request only the specific missing input, finish deployable code/docs/tests, and report deployment blocked. A local production build is not a public deployment.

Verify the actual public production URL in a clean participant browser and an authenticated researcher browser. Recheck consent, real model calls, durable save/resume, approval barrier, exact delivery/measurement/download, refusal/park, and protected researcher APIs. Record tested commit, build identity, URL, screenshots and test output without secrets. Distinguish preview from production.

Prepare `docs/pilot-script.md` for separate 15–20 minute sessions with Sai Teja, Akhilesh and Anand, conducted by the owner with consent. Do not message, recruit or fabricate them yourself. First observe whether each can choose a real decision without assistance, then test the complete journey that their own case permits. Record time to choose, confusion, corrections to read-back, questions used, disposition, refresh behavior and receipt completeness. Ask what felt leading and where help was needed. If all cases park, report that honestly; use labelled synthetic cases for eligible/refusal demonstrations. Three interviews establish usability observations, not efficacy or which experimental condition wins.

Finish with `docs/submission-evidence.md`, setup/deployment instructions, a tested-build report, and precise manual steps for eligible, parked, supported and reversal cases. Report features/limitations honestly, including order-only personalization, bounded human source review, unrun checks, and delayed follow-up not yet due.

Definition of done:

- A fresh environment can reproduce the application using committed source, lockfile, migrations, seed, `.env.example` and README.
- A participant can consent, describe their own decision, correct the model, and complete the valid path without researcher UI leaking into it.
- The server/database enforce all eligibility, crux, assignment, freeze, authorization, approval and claim rules even through direct API requests.
- Eligible delivery is source-scoped, authenticated, exactly persisted, resumable, and measurable with independent explicit scores.
- Parked, supported and unsupported cases have correct outcomes and receipts without forced belief change.
- The three packs retain exact audited claims/caveats; the experiment is accurately labelled as ordering personalization.
- Follow-up links/dates and collection are implemented, while actual not-yet-due outcomes remain absent.
- Critical checks and production build pass, or any blocked criterion is explicitly marked incomplete; none is silently waived.
- Public deployment is claimed only after production verification. Human results are claimed only after real consented sessions.

Begin by inspecting the repository and listed files, create the implementation branch safely, then implement the first vertical slice.

Official implementation references to verify while building:

- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI Responses migration/storage configuration: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Next.js authentication/authorization: https://nextjs.org/docs/app/guides/authentication
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
