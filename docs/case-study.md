# EvidenceFirst — Verified Persuasion Without Unsupported Claims

**Solo capstone · 100X Engineers C7**

**Live product:** https://evidencefirst-fullstack-mvp.vercel.app  
**Source code:** https://github.com/rikkunipun/evidencefirst-fullstack-mvp

## At a glance

- **40+ discovery conversations:** roughly 23 early hackathon interviews and another 20 capstone interviews, followed by three focused follow-ups. This is a conversation count; it is not a claim that 40 people completed the final product.
- **Two complete hackathon cases:** confidence changed from 9→5 and 9→6 after sourced explanations. These cases demonstrated the workflow, not population-level persuasion efficacy.
- **Three reviewed evidence packs:** physical activity, study methods, and learning-style matching, with five source-checked claim units in each pack.
- **One public full-stack product:** adaptive discovery, conservative eligibility, fixed-versus-personalized delivery, immediate measurement, exact receipts, and seven-day follow-up.
- **107 unit tests**, plus real-model, real-database and production smoke tests.

## The problem

People sometimes make decisions because they strongly expect an outcome: avoiding all exercise when a gym is unavailable, depending only on rereading while studying, or choosing a course because they expect it to guarantee better jobs. A normal fact checker starts by asking what is wrong. A persuasive model may produce many claims, including claims that are irrelevant or unsupported.

EvidenceFirst starts earlier: **What did the person do? What did they expect would happen? Which reason is actually holding that expectation up?** Only after the person confirms that reason does the system look for evidence. If the reviewed evidence does not address the exact claim, it stops.

The hypothesis is that reason-matched evidence can preserve persuasive relevance while producing fewer unsupported claims than unrestricted persuasion.

## What the interviews taught me

### 1. Asking for a “belief” did not work

My first question was often some version of “What do you strongly believe?” People froze or answered with broad opinions. Many conversations became stories about procrastination, preferences, cravings, social pressure, or not having enough money. I also struggled to choose the next question after each answer.

The important discovery was that people do not naturally store their lives as neat belief statements. They remember incidents.

### 2. A recent decision was easier to recall

The opening changed to: “Tell me about something you recently chose, avoided, delayed, or paid for.” From that incident, the interview reconstructs four parts:

1. the action the person took;
2. the real alternative they rejected;
3. the outcome they expected;
4. where that expectation came from.

This produced much more concrete answers than directly asking for a belief.

### 3. Most stories were not persuasion cases

The next breakthrough was learning to park cases instead of forcing them into the project. An unread book caused by gaming was a behavior gap. Avoiding a purchase because of budget was a resource constraint. Choosing a food because of taste was a preference. Smoking cessation involved addiction and support needs. None of these becomes an evidence-correction problem simply because a decision occurred.

A case proceeds only when the expected outcome materially caused the decision and an actual money, time, or health consequence has already occurred.

### 4. The stated reason was not always the real reason

Even after finding a candidate belief, people gave several reasons. EvidenceFirst therefore asks for the main reason and uses a counterfactual:

> “If that reason turned out to be false, how far would your confidence fall?”

If confidence would not change, that reason is not carrying the belief. The system may test one more participant-supplied reason, then stop. This is the crux step: it identifies what the evidence must address instead of sending a generic brochure.

### 5. The participant must correct the wording

Model extraction can omit an alternative, timeframe, or comparator. Before qualification, the participant sees separate editable statements for the decision and the exact empirical expectation. Nothing is frozen until the participant confirms both.

### 6. A refusal is a valid result

The final interview funnel became:

1. recent incident;
2. action and rejected alternative;
3. expected outcome;
4. causal role in the decision;
5. actual consequence;
6. participant-confirmed wording;
7. initial confidence;
8. central reason and counterfactual score;
9. source match or honest refusal.

This changed the product goal. Success is not the number of interviews converted into eligible beliefs. Success is classifying each story honestly and finding the smaller set that can be tested safely.

## How the product evolved

### V1 — prove the output

The hackathon version used manual interviews and manually assembled evidence briefs. Two participants reconsidered their claims after seeing sourced information: one whey-protein belief moved from 9 to 5, and one gym-consistency belief moved from 9 to 6. This proved that the input–process–output idea could be demonstrated, but the interviewer still did most of the work.

### V2 — structure the interview

V2 introduced role-aware openings, incident reconstruction, driver categories, six eligibility gates, and explicit parking. Testing showed that the form-heavy interface was difficult to understand. It also confirmed that many student stories were behavior problems rather than misinformation.

### V3.4 — make the logic auditable

V3.4 added corrected score handling, source maps, exact locators, immutable records, evidence directions, supported-belief preservation, and reversal receipts. The conversation was redesigned around one adaptive question at a time.

### Full-stack MVP — make the experiment runnable

The final product is a public Next.js application with server-side model calls, PostgreSQL persistence, authenticated researcher tools, deterministic eligibility and assignment, exact delivery receipts, and tokenized seven-day follow-up.

## What the final product includes

- Adult consent and a clear AI/model-provider disclosure.
- Optional role and topic cues to help the participant remember an incident.
- A bounded adaptive interview with message-level provenance.
- Participant correction of the decision and empirical claim.
- Deterministic checks for current, specific, causal, consequential, checkable, safe, and in-scope cases.
- Initial confidence, crux testing, and a final pre-evidence baseline.
- Reproducible assignment to a fixed or personalized condition.
- Delivery assembled only from approved, versioned claim units.
- Immediate confidence, explanation, and intended behavior.
- Exact participant and researcher receipts.
- A seven-day follow-up that is unavailable before its due time.
- A researcher dashboard, de-identified export, and reversal QA.

The model asks questions, extracts candidate fields, and proposes a closed claim category. Deterministic code controls consent, states, eligibility, scores, assignment, approved claim wording, delivery, and follow-up. The model never writes the final factual brief freely.

## Evidence and comparison design

The MVP contains three deliberately narrow packs: general physical activity, study methods, and learning-style matching. Each pack contains five reviewed claims with an exact sentence, source, URL, locator, evidence note, reason tags, direction, and version.

The **fixed condition** shows the same dense brief for that belief cluster. The **personalized condition** uses the same evidence inventory but orders the approved claims around the participant's confirmed central reason. This keeps factual budget and source quality constant while testing whether relevance creates the difference.

The reversal test checks that the system does not always argue against the participant. A supported claim is preserved. A broader or unsupported claim receives zero factual claims rather than an invented correction.

## What has been demonstrated

The product works end to end on the public deployment. Tests cover supported delivery, contradiction, preference parking, out-of-scope refusal, score handling, duplicate protection, receipts, and follow-up timing. Source links and locators appear directly in the participant brief.

The work does **not** yet establish persuasion efficacy. The two hackathon cases are useful demonstrations, and the software tests establish functional behavior. A proper conclusion requires consented fixed-versus-personalized participants, blinded unsupported-claim review, and seven-day outcomes.

## What changed in my thinking

I began by treating the project as a sourced persuasion generator. The interviews showed that the harder and more valuable problem is deciding whether a checkable, consequential belief has been found at all. The final product therefore treats discovery, conservative qualification, supported-belief preservation, and refusal as core product behavior.

EvidenceFirst is not designed to win every argument. It is designed to understand what the person is defending, show only evidence that addresses that reason, and stop when the evidence is not good enough.
