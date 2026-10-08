# EvidenceFirst V3 — Product Requirements Document

**Status:** Build specification  
**Prepared:** 8 October 2026  
**Build window:** 2 days — 8–9 October 2026, submission at 9:00 PM IST  
**Purpose:** A deployable research prototype for the Verified Persuasion capstone

## 1. Product in one sentence

EvidenceFirst conducts a short text or voice conversation, identifies whether a participant's decision was materially caused by a specific checkable expectation, and—only for an audited domain—delivers a source-gated response whose exact claims and outcomes can be reviewed later.

## 2. The user problem

People sometimes make costly decisions because of expectations they cannot easily evaluate, while ordinary chatbots can sound convincing without preserving proof that each factual claim was supported.

## 3. Research question

Can a reason-matched, source-gated response change a participant's confidence as much as a fixed dense brief while producing fewer unsupported factual claims?

V3 must make this question testable. It is not a general truth engine, therapist, medical adviser, career counsellor, or autonomous web researcher.

## 4. What makes V3 a real product

V3 must have all of the following:

1. A public HTTPS URL that works outside ChatGPT and without the developer's account.
2. A mobile-first participant experience with reliable text input. Push-to-talk is added only after the complete text path works.
3. Server-side model calls. No API key is sent to the browser.
4. Persistent sessions that survive refreshes and can resume from another device through a participant code.
5. A deterministic state machine that prevents users from jumping past incomplete stages.
6. A database containing exact transcripts, frozen belief wording, experimental condition, delivered claims, source IDs, scores, and timestamps.
7. A researcher dashboard for approval, auditing, export, and follow-up.
8. A fixed-brief condition and a personalized condition with the same claim-count and approximate word budget.
9. A refusal path for unsupported domains or claims.
10. A reviewable receipt for every completed or parked session.

## 5. Product strategy

### 5.1 Breadth

- **Discovery is domain-open.** A participant may describe any recent decision.
- **Persuasion is domain-closed.** V3 may persuade only when the selected belief maps to an enabled, manually audited evidence pack.
- Ship with the existing exercise/non-gym evidence pack. Add one different pack only if the final participant cluster requires it and every sentence is audited before use.

### 5.2 Why the system defaults to five claims

Five is an experimental control, not a universal law of persuasion. Both conditions receive the same number of claim units so claim count does not explain the result. Make it an environment/configuration value named `EXPERIMENT_CLAIM_COUNT`, defaulting to `5`. Do not let the personalized branch silently add claims. A claim unit is one independently checkable factual assertion, not one paragraph or bullet.

### 5.3 Human approval

For the capstone build, a researcher must approve the generated brief before delivery. The automated verifier can block obvious failures, but human review provides a clean boundary while the evidence library is small. The receipt records the approver and time.

## 6. Users

### Participant

- May be unfamiliar with the word “belief.”
- Uses a phone.
- Can speak or type in plain language.
- Sees one question at a time.
- Must be told that this is an AI-assisted research prototype.
- Can stop and withdraw before delivery.

### Researcher

- Reviews candidate beliefs and supporting evidence.
- Approves or rejects a participant-facing brief.
- Runs the reversal test.
- Exports records for analysis and submission.

## 7. Participant journey

### Step 1 — Welcome and consent

Show:

- what the study does;
- that the participant is speaking with an AI-assisted prototype;
- what will be recorded;
- the ability to stop;
- topic exclusions;
- consent checkbox and explicit continue action.

Collect a generated participant code. A name and contact method are optional and stored separately from the conversation.

After consent, ask **“Which sounds most like you right now?”** using seven first-person situation cards: student, early-career worker, experienced professional, freelancer, business owner, home/parent role, and retired/60+. The choice changes which topic cards appear; it must not determine what the participant is assumed to believe.

Show 10–12 short topic cards for the selected situation, grouped under Health and body, Money, and Study and work. Each card uses a first-person title and a three-option subtitle. Mark enabled audited topics as **Sourced response available** and grey the rest as **Discovery only**. Include **Something else**. Shuffle within each group once per session to reduce first-position effects.

Topic cards are neutral retrieval cues, not conclusions. Selecting topics where misconceptions are common is allowed; assuming this participant holds the misconception or steering them toward a desired correction is not. If the participant's belief is supported, the product must preserve it and record that result.

### Step 2 — Choose input

Text input is required. If the complete text path has passed production testing, also offer **Hold to speak**.

Push-to-talk records one answer, sends audio to a server transcription endpoint, displays the transcript, and lets the participant edit it before submission. Audio is deleted after a successful transcript unless separate audio-retention consent was recorded.

Do not delay the submission for voice. Do not build continuous real-time voice. Turn-based voice is an optional enhancement after the complete text path works because it is easier to audit and correct.

### Step 3 — Discover one recent decision

The conversation starts from the participant's role and one concrete event. It never opens with “What is your belief?”

The system asks exactly one short question per turn and attempts to fill:

- chosen action;
- rejected alternative;
- expected outcome;
- source of that expectation;
- actual consequence;
- consequence evidence;
- current confidence;
- candidate reasons and their relative importance;
- evidence or experience that could change the participant's mind.

The system has an eight-question budget. It stops earlier when the required fields are stable. If no candidate is found, it parks the session honestly.

The model produces only the next question and a structured extraction proposal. Deterministic code owns the question budget, required fields, eligibility, condition assignment, evidence access and stopping. Text and corrected voice transcripts enter the same state machine.

### Step 4 — Participant read-back

Show an editable card:

> I chose **[action]** instead of **[alternative]** because I expected **[outcome]**.

The participant can edit it or confirm it. Store both the generated wording and confirmed wording. No case may advance without confirmation.

### Step 5 — Automatic diagnosis and eligibility

The model proposes a classification, but a server-side rules engine decides whether required fields exist. The participant answers plain questions; they do not see research jargon.

The six required checks are:

1. **Current:** Is this still what you expect today?
2. **Specific:** Are action, alternative, expected outcome, scope, and time clear?
3. **Causal:** Did this expectation materially affect the decision?
4. **Consequential:** Has an actual money, time, or health cost already occurred?
5. **Checkable:** Can credible evidence or a feasible personal test address the claim?
6. **Safe and in scope:** Is it outside political, religious, identity, crisis, addiction-treatment, and individualized medical/legal/financial persuasion?

If one check fails, show the precise reason and park or request one clarification. A score cannot compensate for a failed check.

### Step 6 — Freeze, baseline, and identify the crux

Display the final belief statement and ask for confidence from 0–10 before testing reasons or showing evidence. Save an immutable versioned snapshot containing:

- exact wording;
- score;
- participant reason;
- qualifying consequence;
- evidence of consequence;
- timestamp.

Then run a maximum two-pass crux check:

1. “What is the main reason you are at that number?”
2. Confirm the reason in the participant's wording.
3. “Suppose that reason turned out not to be true. What would your confidence be then, from 0 to 10?”
4. If the score is unchanged, ask for one other reason and repeat once.

Store the exact reason, baseline score, hypothetical score and difference. A reason is a provisional crux only if the participant identifies it as important, its removal lowers stated confidence, and evidence or a feasible test can address it. Never tell the participant that the score should fall.

Classify the reason before retrieving evidence:

- **current observable claim:** eligible for source checking;
- **near-term personal prediction:** eligible for a feasible personal test;
- **distant or open-ended forecast:** narrow it to a current claim or park it, because present evidence cannot settle an indefinite future;
- **value, identity or emotional commitment:** preserve it and park factual persuasion.

After the crux questions and before any evidence, ask for confidence again. This creates three distinct measurements: initial baseline, post-elicitation/pre-evidence confidence, and post-evidence confidence. Never reconstruct or infer any of these scores later.

If no checkable crux appears after two passes, park the case or deliver only a non-persuasive research receipt. If the crux is supported by evidence, preserve or qualify the belief instead of forcing change.

This is a product hypothesis, not a diagnostic instrument. Do not descend into identity, trauma, shame or emotionally charged core beliefs.

### Step 7 — Experimental assignment

Eligible sessions are assigned server-side to one of two conditions:

- **Fixed brief:** the same prewritten claim set for every participant in the selected belief cluster.
- **Personalized brief:** claims selected from the same approved evidence pack to address the participant's confirmed provisional crux.

Use reproducible 1:1 blocked randomization within the belief cluster. Store the assignment and algorithm version. Participants must not choose their condition.

### Step 8 — Build and verify the brief

Each evidence unit contains:

- a stable ID;
- atomic approved claim text;
- source title and URL;
- an exact supporting passage or structured evidence note;
- scope and limitations;
- reason tags;
- domain and version;
- audit status.

The generator may select and arrange approved evidence units. It may add non-factual connective language, but it may not invent new factual assertions.

Before delivery:

1. split the draft into factual claims;
2. map each factual claim to an evidence-unit ID;
3. reject unmapped or broader wording;
4. enforce configured claim count and word budget;
5. require researcher approval.

### Step 9 — Deliver

Show:

- a brief acknowledgement of the participant's reason;
- exactly the configured number of claims;
- source links beside the relevant claims;
- uncertainty and valid parts of the original concern;
- a practical personal test only when appropriate;
- no claim that the participant is irrational or “wrong.”

Store the exact rendered text and claim IDs before it appears on screen.

### Step 10 — Immediate measurement

Ask:

1. Your confidence in the exact belief now, 0–10?
2. Which point changed, failed to change, or complicated your view, and why?
3. What, if anything, will you do differently?

Do not interpret a lower score as success automatically. Preserve the explanation.

### Step 11 — Follow-up

Create a unique follow-up URL and due date seven days after delivery. The follow-up repeats the exact belief wording and asks:

- confidence 0–10;
- whether the relevant decision or behavior occurred;
- what else affected the result.

If the deadline occurs before seven days, display “not yet due” and report it honestly.

### Step 12 — Receipt

Participant receipt:

- participant code;
- frozen belief;
- sources shown;
- before and after scores;
- follow-up link.

Research receipt additionally contains condition, prompt/model/app versions, exact delivered text, claim audit, approver, timestamps, and errors.

## 8. Researcher dashboard

### Dashboard home

Show counts by state:

- consented;
- discovery;
- parked;
- awaiting approval;
- delivered;
- immediate measurement complete;
- follow-up due;
- complete.

### Session review

Show in one vertical trace:

1. transcript;
2. extracted fields and model confidence;
3. participant corrections;
4. eligibility decision and reasons;
5. baseline snapshot;
6. assigned condition;
7. generated draft;
8. claim-to-source map;
9. researcher edits and approval;
10. exact delivery;
11. measurements.

### Evidence library

Researchers can create, edit, version, enable, or disable evidence units. A changed unit creates a new version and never rewrites an old receipt.

### Experiment view

Show descriptive results only:

- number assigned to each condition;
- immediate and delayed score changes;
- completion rate;
- unsupported-claim count;
- parked reasons;
- participant explanations.

Do not claim statistical significance for a tiny sample.

### Export

Export CSV and JSON with de-identified participant codes. Export the exact claim audit separately.

## 9. Reversal test

The researcher can enter a claim that the active evidence pack does not support. The system must:

1. search only enabled evidence units;
2. report that support was not found;
3. refuse to produce a persuasive factual brief;
4. store the unsupported input and refusal receipt;
5. deliver zero unsupported factual claims.

This is a first-class demo path, not an error screen.

## 10. State machine

```text
CONSENT
  -> DISCOVERY
  -> CANDIDATE_REVIEW
  -> ELIGIBILITY
     -> PARKED
        -> FROZEN
        -> BASELINE_RECORDED
        -> CRUX_CONFIRMED
        -> ASSIGNED
        -> DRAFTED
        -> VERIFIED
        -> AWAITING_APPROVAL
        -> APPROVED
        -> DELIVERED
        -> IMMEDIATE_MEASURED
        -> FOLLOWUP_DUE
        -> COMPLETE
```

Every transition is validated on the server. Back navigation may show earlier content, but immutable experiment records cannot be silently overwritten.

## 11. Recommended technical architecture

### Stack

- **Frontend and server:** Next.js App Router, TypeScript, Tailwind CSS.
- **Hosting:** Vercel with preview and production deployments.
- **Database and researcher authentication:** Supabase Postgres and Supabase Auth.
- **Validation:** Zod schemas shared between UI and server.
- **AI text:** OpenAI Responses API with Structured Outputs.
- **Voice input:** browser `MediaRecorder` plus server-side OpenAI audio transcription.
- **Testing:** Vitest for the rules engine and Playwright for the critical participant paths.

### AI boundary

Use the model for:

- proposing the next single discovery question;
- extracting structured fields from participant words;
- proposing a classification with uncertainty;
- selecting reason-relevant approved evidence units;
- drafting within approved claim text and constraints.

Use deterministic code for:

- required-field checks;
- state transitions;
- experiment assignment;
- claim-count and word-budget enforcement;
- enabled-domain checks;
- persistence and receipts;
- follow-up dates;
- export.

Use a human for:

- approving participant-facing persuasion during the capstone;
- approving and versioning evidence units;
- resolving ambiguous sensitive cases.

## 12. Structured discovery contract

Every model turn must return a schema equivalent to:

```ts
type DiscoveryTurn = {
  assistantQuestion: string | null;
  extracted: {
    chosenAction: string | null;
    rejectedAlternative: string | null;
    expectedOutcome: string | null;
    expectationOrigin: string | null;
    actualConsequence: string | null;
    consequenceEvidence: string | null;
    scopeAndTime: string | null;
    confidenceScore: number | null;
    changeCondition: string | null;
    candidateReasons: Array<{
      exactReason: string;
      participantConfirmed: boolean;
      hypotheticalConfidenceIfFalse: number | null;
      reasonType:
        | "empirical"
        | "personal_experience"
        | "trusted_source"
        | "social_or_identity"
        | "emotion_or_value"
        | "unclear";
      checkable: boolean | null;
    }>;
  };
  proposedDriver:
    | "outcome_belief"
    | "social_pressure"
    | "practical_barrier"
    | "preference_or_value"
    | "behavior_gap"
    | "mixed"
    | "unclear";
  classificationReason: string;
  shouldStop: boolean;
  stopReason:
    | "candidate_ready"
    | "question_budget_exhausted"
    | "unsafe_or_excluded"
    | "no_stable_candidate"
    | null;
};
```

Constraints:

- `assistantQuestion` is one question and no more than 25 words.
- The model quotes or closely paraphrases the participant; it does not supply a belief.
- Missing information remains `null`.
- A low-confidence classification produces a clarifying question or a park decision.
- The crux prompt never assumes a reason is false or that confidence should decrease.
- The crux loop stops after two candidate reasons.

## 13. Data model

Minimum tables:

### `participants`

`id`, `participant_code`, optional contact reference, consent version, consent timestamp, withdrawal timestamp.

### `sessions`

`id`, participant ID, state, domain, locale, input mode, app version, created/updated timestamps.

### `messages`

`id`, session ID, role, exact text, audio-retained flag, turn number, model metadata, timestamp.

### `discovery_snapshots`

Session ID, extracted fields JSON, proposed driver, confidence, prompt version, model version, timestamp.

### `belief_snapshots`

Session ID, generated wording, participant-confirmed wording, version, frozen timestamp.

### `crux_checks`

Session ID, belief snapshot ID, pass number, exact reason, participant-confirmed flag, baseline score, hypothetical score, score difference, reason type, checkability, disposition, timestamp.

### `eligibility_checks`

Session ID, six booleans, supporting answers, rules-engine version, disposition, reasons.

### `evidence_units`

Stable family ID, version, domain, approved claim, source title, URL, support passage/note, limitations, reason tags, audit status, enabled flag.

### `assignments`

Session ID, cluster ID, condition, randomization key, assignment version, timestamp.

### `deliveries`

Session ID, draft text, approved text, claim IDs, verifier result, approver ID, exact rendered text, delivered timestamp.

### `measurements`

Session ID, phase (`before`, `after`, `day_7`), belief snapshot ID, score, explanation, reported behavior, timestamp.

### `audit_events`

Actor, action, entity, before/after JSON, timestamp.

## 14. Server routes

Use route handlers or server actions with typed validation:

- `POST /api/sessions` — consent and start.
- `POST /api/sessions/:id/messages` — add answer and get the next discovery turn.
- `POST /api/transcriptions` — one push-to-talk audio file to editable text.
- `POST /api/sessions/:id/candidate/confirm` — save participant wording.
- `POST /api/sessions/:id/eligibility` — answer checks and run rules.
- `POST /api/sessions/:id/baseline` — freeze wording and before score.
- `POST /api/sessions/:id/crux` — record up to two reasons and their counterfactual confidence scores.
- `POST /api/sessions/:id/assign` — idempotent server assignment.
- `POST /api/sessions/:id/draft` — generate from enabled evidence units.
- `POST /api/sessions/:id/verify` — claim mapping and constraints.
- `POST /api/sessions/:id/approve` — researcher-only approval.
- `POST /api/sessions/:id/deliver` — persist exact text before returning it.
- `POST /api/sessions/:id/measurements` — immediate or delayed result.
- `GET /follow-up/:token` — participant follow-up.
- `POST /api/admin/reversal-runs` — run and store refusal test.
- `GET /api/admin/export` — de-identified export.

All mutating routes must be idempotent where double-clicks or retries could duplicate an experimental event.

## 15. Security and privacy

- Keep OpenAI and Supabase service-role keys server-side.
- Enable Row Level Security on every exposed Supabase table and grant only required operations.
- Participants access only their session through a high-entropy token; they do not receive broad table access.
- Researcher pages require authentication.
- Store minimal personal information and separate it from research responses.
- Set model API storage according to the study's policy; prefer `store: false` for Responses requests unless stored API state is intentionally required.
- Add rate limits and maximum input/audio sizes.
- Sanitize exported filenames and spreadsheet values.
- Provide withdrawal handling and mark withdrawn records as excluded.

## 16. Interface requirements

### Participant interface

- One central column, large tap targets, mobile-first.
- One question at a time.
- Plain language; no labels such as “causal gate” or “outcome belief.”
- Visible microphone state and transcription review.
- Progress labels based on human tasks: `Tell us what happened`, `Check our understanding`, `Review information`, `Share your response`.
- Save indicator and resume code.
- Source cards open in a new tab and show publisher/title, not raw URLs alone.

### Researcher interface

- Dense information is acceptable.
- Every status label is derived from the database state.
- Failed checks include evidence and a recommended next action.
- Approval UI highlights every factual claim and its mapped source.

## 17. Acceptance criteria

V3 is ready for participant use only when all are true:

1. A new user on a phone can consent and complete a text session without explanation from the developer.
2. Refreshing at every step restores the correct state.
3. A behavior-gap case is parked with a clear reason.
4. An eligible supported case reaches baseline, assignment, approval, delivery, and immediate measurement.
5. The fixed and personalized conditions each deliver the configured claim count and remain within the same word-budget range.
6. Every delivered factual claim has an enabled evidence-unit ID and a source link.
7. An unsupported-domain case cannot reach persuasion.
8. The reversal run produces a refusal and zero delivered factual claims.
9. The researcher can see the complete trace and export it.
10. The OpenAI key is absent from client bundles and logs.
11. Production works from a device and account unrelated to the developer.

Push-to-talk is accepted only if it produces editable text and handles microphone denial gracefully. It is not a release blocker for the two-day submission.

## 18. Required tests

### Unit tests

- eligibility rules for each failed gate;
- valid and invalid state transitions;
- assignment is stable and approximately balanced;
- claim-count and word-budget enforcement;
- evidence unit versioning;
- follow-up due-date logic.
- crux baseline immutability, two-pass limit, and zero-change handling.

### End-to-end tests

- eligible text session;
- parked behavior-gap session;
- unsupported-domain refusal;
- reversal test;
- refresh/resume;
- researcher edits and approves;
- immediate and day-seven measurement;
- crux found, crux not found, and crux supported paths;
- if optional voice is implemented, push-to-talk transcription using a fixture or mocked API.

## 19. Two-day emergency build plan

The deadline is 9:00 PM IST on 9 October 2026. Build one complete, auditable text path before adding voice, visual polish, or extra domains.

### Day 1 — 8 October: working participant path

#### Block 1: first 2 hours — foundation

- Create a new repository; do not rewrite the frozen static prototype.
- Scaffold Next.js and connect Supabase.
- Add environment validation and deploy an empty Vercel preview immediately.
- Create the minimum tables: sessions, messages, belief snapshots, eligibility checks, evidence units, assignments, deliveries, measurements, and audit events.
- Implement server-side session state and seed the audited exercise evidence pack.

**Exit:** the public preview opens, creates a session, and persists it.

#### Block 2: next 4 hours — discovery and qualification

- Build consent and the one-question text conversation.
- Add the Structured Output extraction contract and eight-question stop rule.
- Add participant belief read-back and confirmation.
- Implement the deterministic six-gate decision and clear park reasons.
- Add the frozen wording and before score.

**Exit:** one behavior-gap case parks correctly and one prepared eligible fixture reaches the frozen baseline.

#### Block 3: final 3 hours — condition and evidence path

- Implement idempotent fixed/personalized assignment.
- Implement fixed and reason-matched selection from approved evidence units.
- Enforce claim count, word budget, source mapping, and unsupported-domain refusal.
- Add a minimal researcher approval screen protected by an environment-configured admin login or allowlist.

**Exit:** a verified draft waits for approval and an unsupported topic produces a refusal receipt.

### Day 2 — 9 October: complete, test, deploy, document

#### Block 1: first 3 hours — delivery and measurement

- Persist the exact approved text before delivery.
- Add participant delivery, source cards, after score, explanation, and action intention.
- Generate a seven-day follow-up link and mark it “not yet due.”
- Add participant and researcher receipts.

**Exit:** the entire supported text flow completes without database edits.

#### Block 2: next 3 hours — dashboard and reversal

- Build one session-trace page and de-identified JSON/CSV export.
- Add the reversal-run page and refusal receipt.
- Display fixed versus personalized counts and descriptive score changes.

**Exit:** a reviewer can inspect every delivered claim, source, score, and state transition.

#### Block 3: next 2 hours — real testing

- Run one supported pilot, one parked case, and one reversal case through the public preview.
- Test refresh/resume, mobile layout, invalid inputs, duplicate clicks, and source links.
- Fix blockers, data loss, incorrect state, and unsupported-delivery failures first.

**Exit:** three complete receipts exist and the supported pilot works without developer explanation.

#### Block 4: final 2 hours — freeze and submission

- Promote the tested commit to Vercel production.
- Open it from an incognito browser or unrelated device.
- Export the records, capture screenshots or a short demo video, record known limitations, and freeze the commit and evidence versions.

**Exit:** public URL, repository commit, supported-run receipt, parked receipt, reversal receipt, export, and limitations statement.

Stop feature work by **7:00 PM IST**. Use 7:00–8:00 PM for the final public-device test and submission package, and keep 8:00–9:00 PM as a failure buffer.

### Optional only after every required exit condition passes

1. Push-to-talk with editable transcription.
2. Additional visual polish.
3. A second audited evidence domain.

If an optional feature threatens production stability, remove it before submission.

## 20. Features explicitly deferred

Do not spend the build window on:

- native iOS or Android apps;
- continuous full-duplex voice;
- live web search or autonomous source crawling;
- more than one audited persuasion domain unless participant selection forces a change;
- complex charts or statistical claims;
- multiple researcher organizations;
- social feeds, notifications, gamification, avatars, or animation;
- automatic delivery without human approval;
- arbitrary participant uploads;
- a general-purpose chatbot screen.

## 21. Demo script

1. Open the public participant URL in a clean mobile browser.
2. Consent and answer by voice.
3. Show the system asking one adaptive question at a time.
4. Correct one detail in the belief read-back.
5. Show an ineligible case being parked or load an eligible prepared pilot.
6. Freeze the exact belief and record the before score.
7. Open the researcher dashboard and show condition assignment.
8. Inspect the claim-to-source map and approve.
9. Return to the participant view and deliver the brief.
10. Record the after score and explanation.
11. Show the receipt and day-seven link.
12. Run the reversal case and show the refusal receipt.

## 22. Submission evidence

Preserve:

- public URL and repository commit;
- consent and participant disclosure;
- exact transcripts;
- participant-confirmed belief wording;
- qualifying consequence evidence;
- condition assignment;
- exact fixed and personalized outputs;
- claim-to-source audits;
- immediate and day-seven measurements;
- reversal receipt;
- failures and changes from V1/V2/V3;
- a short statement of what the results did to the hypothesis.
