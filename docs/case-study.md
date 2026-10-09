# EvidenceFirst — Verified Persuasion Without Unsupported Claims

**Solo capstone · 100X Engineers C7 · 9 October 2026**

**Live product:** https://evidencefirst-fullstack-mvp.vercel.app  
**Source:** https://github.com/rikkunipun/evidencefirst-fullstack-mvp

## The problem

People sometimes make costly decisions because they strongly expect a particular outcome: avoiding all exercise when a gym is unavailable, relying on one study method, or choosing a course because of a job-market claim. Ordinary fact checking starts with what is wrong. Persuasion systems often add many claims, some of which are irrelevant or unsupported.

EvidenceFirst starts somewhere else: **what did this person do, what did they expect would happen, and which reason is actually holding that expectation up?** It then delivers evidence only when an approved source directly addresses that reason. A refusal is a valid product outcome.

## The hypothesis

If a system identifies the participant's central, checkable reason and asserts only source-mapped claims that address it, it can preserve persuasive relevance while producing fewer unsupported claims than unconstrained persuasion.

The capstone does not assume that every belief is false. The system must also preserve supported beliefs, qualify mixed claims, and park cases driven by preference, resources, habits, identity, or topics outside the reviewed evidence library.

## The hardest discovery

The first interviews repeatedly failed. Asking people to name a “belief” produced silence, broad philosophy, procrastination stories, preferences, and purchases that did not involve a disputed factual expectation. The interviewer's next question was also difficult to choose consistently.

The useful shift was from abstract belief recall to a concrete incident:

1. What did you choose, avoid, delay, or pay for recently?
2. What alternative did you reject?
3. What outcome did you expect?
4. Did that expectation materially cause the decision?
5. What cost has already happened?
6. What is the main reason you are confident?
7. If that reason were false, how far would confidence fall?

This separates factual or predictive claims from behavior gaps, social pressure, practical barriers, and personal values. It also turns belief discovery into a bounded product capability rather than a recruitment assumption.

## How the product evolved

### V1 — demonstrate the output

The hackathon prototype manually interviewed participants, assembled sourced briefs, and remeasured confidence. It demonstrated the intended input, process, and output, but discovery depended heavily on the interviewer and the workflow was not reproducible.

### V2 — structure discovery

V2 introduced role-aware prompts, incident reconstruction, driver classification, six eligibility gates, and explicit parking. Testing showed that form-heavy screens were difficult to understand and that many student examples were behavior problems rather than misinformation.

### V3.4 — bound the research logic

V3.4 froze corrected score handling, timestamps, immutable records, evidence maps, source locators, supported-claim preservation, and reversal receipts. It also enabled three small source-reviewed evidence packs.

### Full-stack MVP — make the experiment real

The final build moves the workflow to a public Next.js application with server-side AI calls, PostgreSQL persistence, authenticated researcher tools, reproducible condition assignment, exact delivery receipts, and tokenized seven-day follow-up.

## Participant journey

1. Adult consent and disclosure that an AI-assisted prototype and model provider are involved.
2. Optional role and topic cues that help recall a recent decision without forcing a belief.
3. One-question-at-a-time adaptive interview.
4. Participant correction and confirmation of the decision and exact expectation.
5. Deterministic eligibility checks for current, specific, causal, consequential, checkable, safe, and in-scope cases.
6. Initial confidence score.
7. Central-reason confirmation and counterfactual confidence check.
8. Final pre-evidence baseline and reproducible experimental assignment.
9. Fixed or personalized delivery from the same bounded evidence pack.
10. Immediate confidence, explanation, intended behavior, exact receipt, and seven-day follow-up link.

## System design

The model does only the tasks that need language understanding:

- ask the next neutral question;
- extract candidate fields with message-level provenance;
- classify a candidate claim into a closed policy kind or return none/unclear;
- summarize wording for participant correction.

Deterministic code controls:

- consent and age gate;
- state transitions;
- eligibility;
- score validity, including zero and null;
- condition assignment;
- evidence-pack membership;
- exact claim wording and source links;
- delivery acknowledgement;
- record freezing and content hashes;
- receipts and follow-up timing.

This split prevents the same model that wants to persuade from freely inventing the facts used to persuade.

## Evidence architecture

The MVP contains three narrow packs: general physical activity, study methods, and learning-style matching. Each pack has five approved claim units with an ID, exact wording, source, URL, locator, evidence note, reason tags, direction, and version.

The personalized condition changes which approved facts arrive first based on the participant's confirmed reason. It does not change the factual inventory or add persuasive prose. The fixed condition uses a versioned dense brief from the same pack. This makes relevance the experimental difference rather than tone, model size, or factual budget.

When no approved claim direction matches, EvidenceFirst says the evidence library cannot address the exact claim. It does not treat missing evidence as proof of falsity.

## Reversal test

The reversal route tests whether the system always argues against the participant. Exact supported assertions are preserved; broader, cross-pack, or unsupported claims are refused with zero factual claims delivered. Reversal receipts are stored as first-class QA evidence.

## What was verified

- 107 unit tests pass.
- TypeScript, linting, and the production build pass.
- Real-model, real-database tests cover supported delivery, preference parking, out-of-scope refusal, follow-up timing, immutable receipts, and both automatic and manual review modes.
- Production smoke tests reached delivery, measurement, and receipt without participant authentication.
- Mobile overflow, withdrawal, idempotent retry, duplicate delivery, capability cookies, RLS boundaries, and secret exposure were checked.
- Official source links and source locators are shown directly in the participant brief.

These results establish functional correctness and safety behavior. They do not establish persuasion efficacy. Synthetic QA records are marked as test data and excluded from human-result claims.

## What changed after evidence

The project began with the assumption that the main task was to produce a persuasive sourced response. Interviews showed that the earlier bottleneck is deciding whether a real belief has been found at all. The final hypothesis therefore includes discovery quality, conservative qualification, and honest refusal as part of the product.

The design also changed from a mandatory human gate to two explicit modes. Manual review remains available for facilitated research. The production pilot uses a closed deterministic policy for automatic delivery and records system validation separately from human review. Researcher auditing remains visible after delivery.

## Current limitations

- Evidence coverage is deliberately narrow; recall is lower than a general web-search system.
- Some valid claims receive a refusal because their direction has not been reviewed.
- Adaptive turns can take roughly 10–25 seconds.
- Model extraction can lose an important comparator, so participants must verify the exact wording.
- Automatic policy matching is not full scientific entailment.
- Development and production share a Supabase project.
- Human comparison and delayed-outcome evidence remain necessary before evaluating the persuasion hypothesis.

## What I would build next

1. Run consented fixed-versus-personalized pilots with a preregistered analysis.
2. Measure unsupported claims per delivered brief through blinded review.
3. Improve structured extraction so every claim preserves its action, comparator, outcome, scope, and timeframe.
4. Expand evidence packs only after independent source review.
5. Add a faster interview model and measure whether speed changes completion quality.
6. Use the seven-day result to distinguish immediate agreement from durable belief and behavior change.

## Closing

EvidenceFirst is not designed to win every argument. It is designed to know what the person is defending, show only evidence that addresses that reason, preserve supported beliefs, and stop when the evidence is not good enough.

