# EvidenceFirst adaptive crux implementation — 8 October 2026

## Decision

Use the one-question-at-a-time interaction as the participant experience, with strict safeguards. It solves the interview problem better than a form because each question can use the participant's last answer. It does not make the model the judge of truth or eligibility.

## What the example interaction gets right

- It asks one short question at a time.
- It reflects the participant's wording before continuing.
- It freezes a specific claim and confidence score.
- It uses a counterfactual stability question to find a reason that may carry the belief.
- It recognizes that present evidence cannot settle every distant prediction.

## What must not be copied

The example moves from the participant's AI-career score directly to an invented reason: that coding mistakes will become so rare that understanding code will not matter. The participant did not supply or confirm that reason. It then reports an “after elicitation” score that was never separately measured. Both errors would make the result look more precise than the conversation supports.

## Implemented V3.2 flow

1. Start with role and a recent decision, not “What is your belief?”
2. Ask one question at a time for action, available alternative, expected outcome, and origin of that expectation.
3. Read the story back and require participant confirmation.
4. Diagnose outcome belief versus social pressure, practical barrier, preference, or behavior gap.
5. Apply the six eligibility checks and park any failed case.
6. Freeze the exact belief and record the initial confidence score.
7. Ask for the participant's main reason. Reflect and confirm it.
8. Ask what confidence would be if that reason were false. If confidence does not fall, test one other participant-supplied reason and stop.
9. Classify the reason as a current claim, near-term personal test, distant forecast, or value/identity commitment.
10. Continue only for a participant-confirmed, load-bearing, checkable current claim or near-term test.
11. Record a fresh pre-evidence score so elicitation and evidence effects remain separate.
12. Assign the fixed or personalized condition, deliver only approved source-mapped claims, and store the exact output.
13. Record immediate confidence, explanation, and the honest follow-up date.

## Deadline scope

Ship the reliable text path first. Voice, unrestricted domains, autonomous browsing, and visual polish remain deferred. The submitted demo should include one eligible run, one parked run, and one unsupported-claim reversal receipt.
