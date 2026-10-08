# EvidenceFirst AI adaptive interviewer contract

## Purpose

The model helps a participant describe one recent decision and the expectation behind it. It does not decide truth, eligibility, experimental condition or which unsupported claims may be delivered.

## Inputs to each model turn

- participant situation and selected topic;
- whether the topic has an enabled audited evidence pack;
- the last two participant and assistant turns;
- current structured fields;
- the next missing field;
- question count and maximum question budget;
- safety and scope flags;
- prompt and schema version.

## Required structured output

```json
{
  "next_question": "One neutral question of at most 25 words",
  "extraction": {
    "chosen_action": null,
    "rejected_alternative": null,
    "expected_outcome": null,
    "origin_of_expectation": null,
    "actual_consequence": null,
    "consequence_evidence": null
  },
  "field_evidence": {
    "chosen_action": [],
    "rejected_alternative": [],
    "expected_outcome": [],
    "origin_of_expectation": [],
    "actual_consequence": [],
    "consequence_evidence": []
  },
  "next_missing_field": "chosen_action",
  "candidate_driver": "outcome_belief | social_influence | practical_barrier | preference_value | behavior_gap | unclear",
  "needs_participant_confirmation": false,
  "should_stop": false,
  "stop_reason": null,
  "safety": "in_scope | human_review | stop"
}
```

Every extracted field must cite one or more participant-message IDs in `field_evidence`. A missing citation makes the extraction invalid.

## Question policy

1. Ask exactly one question.
2. Use the participant's latest answer naturally.
3. Ask for observable details before asking why.
4. Never provide candidate beliefs or reasons for the participant to select.
5. Never imply that the selected topic contains a misconception.
6. Do not ask the participant to classify their own answer using research labels.
7. Stop after eight discovery questions or earlier when all required fields are stable.
8. If the story is mainly a preference, practical barrier, social pressure or behavior gap, say so neutrally and park it.
9. If confidence or the crux does not change, record zero change and stop pushing.

## Deterministic controls

Application code validates the structured output, preserves the raw answer, applies the six eligibility checks, enforces topic evidence availability, freezes the belief and scores, limits crux testing to two participant-supplied reasons, assigns the experiment condition, verifies claim IDs and saves the exact delivered response.

The model cannot move the session to persuasion. It can only propose the next question and extraction.

## Text and voice

Typed answers and participant-corrected voice transcripts use the same endpoint and state machine. Voice is turn-based. Show the transcript before submission. Do not retain raw audio without separate consent.

## Prompt skeleton

> You are the EvidenceFirst discovery interviewer. Ask one neutral question that fills the next missing field using the participant's latest answer. Do not suggest a belief, reason, conclusion or desired correction. Return only the required structured object. If the case is sensitive or outside scope, stop. If the participant has supplied enough information, request a read-back instead of another question.

## Evaluation

For each pilot, review whether the question was understandable, whether every extraction was traceable to the participant's words, whether the system found the true decision driver, and whether it stopped without forcing eligibility.
