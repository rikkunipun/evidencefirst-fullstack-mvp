# EvidenceFirst V3.4 local research pilot

This is a facilitated, static prototype. Serve `dist/` over local HTTP:

```sh
python3 -m http.server 8878 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8878/`. The seven situations and neutral topic cards lead to decision reconstruction, participant read-back, six eligibility checks, an explicit baseline, and at most two participant-supplied crux checks.

Three source-checked packs are enabled: general activity outside a gym (2.0), study methods (1.0), and learning-style matching (1.0). Study methods is reused by the skills and child-study cards. Other topics remain discovery only. Every pack has exactly five approved factual claim units. The personalized condition rearranges those same units by reason tags; it does not add claims or imply that the participant is wrong.

Before participant delivery, a facilitator reviews the draft against the exact belief and crux, records a reviewer code and scope justification, and chooses whether the evidence supports, qualifies or fails to address that claim. An unsupported review ends in a refusal. Supported beliefs are explicitly preserved. The app does not authenticate the reviewer or automate scientific entailment.

Baseline wording, initial score, crux, condition and exact delivery are frozen in the local session. Missing scores are null, and zero is valid. After an explicit immediate score and explanation are recorded, measurement fields are locked. Receipts include source IDs, locators, evidence notes, pack versions and exact HTML/text. Seven-day follow-up due time is calculated from delivery; follow-up collection is not connected.

The start screen contains a researcher reversal check. It only accepts exact audited assertions as supported; unsupported paraphrases or broader claims are refused. A failure to find support is not a claim of falsity.

Run the evidence-library checks with Node 18 or later:

```sh
node --test tests/evidence-packs.test.cjs
```

## Limits and next implementation

The interviewer uses deterministic templates. No model endpoint, server state machine, database, cross-device resume, authenticated researcher dashboard, blocked experimental assignment, or follow-up URL is implemented. All session controls and 1:1 random assignment run in the browser. This is not a tamper-resistant research system. JSON and the static bundle are deployable; server work must be completed before describing the full V3 product requirements as met.

V3.3 local-storage records use a separate key and are preserved. V3.4 does not reinterpret their default slider scores as observed measurements. Browser speech recognition is optional and may use the browser provider; editable transcripts enter the same text flow. The page does not retain raw audio.

Do not count the October 8 synthetic QA fixtures as human pilot sessions, persuasion outcomes, or evidence of efficacy.
