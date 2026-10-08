# EvidenceFirst V3.4 — audit and handoff

Prepared 8 October 2026. Deadline: **9 October 2026, 9:00 PM IST**.

The highest-priority incomplete item is complete locally: **two additional evidence packs are enabled**, with source locators, limitations, and an explicit researcher scope review before participant delivery. The prototype remains static and deployable. It is not the full server-backed V3 product.

Tested local commit: `f830f11c1b9e870c8edd18fbb9a9b1512ee8a293`.

## What was inspected

- The earlier workspace’s five handoff/specification Markdown documents, the persona/topic research PDF, and the supplied October 8 headphone receipt.
- Canonical repository: `/Users/nipunrikapu/Documents/Codex/2026-09-13/for-the-context-there-is-a/siddhant-mvp-v1`.
- Starting Git state: clean `main`, commit `45cd10d`, four commits ahead of the cached `origin/main` reference.
- Final Git state: clean `main`, five commits ahead of that cached reference. Remote synchronization did not complete, so this does not establish the live remote’s current HEAD.
- Existing Site access: public; no access settings were changed. Its reported existing live URL is `https://evidencefirst-mentor-v1.rikapurambabu74.chatgpt.site`. **That publication does not contain the changes from this turn.**

## V3.3 audit findings and local repairs

The eligible activity path reached evidence delivery and resumed after refresh. The implementation had four material problems:

1. Activity-topic selection alone could authorize a generic gym brief without checking whether the exact belief and crux were within the evidence scope.
2. Default sliders were exported as observed scores, including an unasked after-score of 8. The pre-evidence score used a fallback that could overwrite a legitimate zero.
3. Frozen wording, earlier inputs and delivered evidence could be changed or regenerated through back navigation. Session timestamps changed on receipt rendering.
4. Receipts omitted the delivered source map, source links and supporting locators, and lacked a first-class reversal receipt.

V3.4 requires explicit numeric scores, records missing observations as `null`, and preserves zero. Belief wording, baseline, qualifying consequence, scope/time, crux, condition, exact delivered text/HTML and measured outcomes are locked at their corresponding transitions. Creation and delivery timestamps persist. Cost evidence and claim scope/time must be recorded. Participant read-back answers can be corrected before freezing. Changing topic before freezing clears the previous topic’s discovery.

A facilitator must record a reviewer code, source-scope justification and scope confirmation, and choose whether evidence supports, qualifies or fails to address the exact claim. Unsupported review refuses delivery. Supported review explicitly preserves the belief. The receipt describes this as a **local attestation**, not authenticated human approval. The draft screen is labelled researcher review; the approved response appears on the outcome screen.

## Enabled evidence packs

| Pack | Version | Atomic claim IDs | Relevant topic cards |
| --- | --- | --- | --- |
| General activity outside a gym | 2.0 | C1, C2, C3, C4, C6 | Activity |
| Study methods — new | 1.0 | S1–S5 | Study, skills, child study |
| Learning-style matching — new | 1.0 | L1–L5 | Learning |

Other topics remain discovery only. Reusing the study pack across three cards does not create three separate packs.

Each condition receives the same five approved claim units. Personalization rearranges them using tags from the confirmed participant reason, without adding or rewriting assertions. This gives identical claim-text word budgets but is **order personalization**, a limited implementation of the eventual reason-matched condition.

### Source review

- Study methods: [Dunlosky et al. (2013), full paper](https://acs.ist.psu.edu/ist521/dunloskyRMNW13.pdf). Each unit identifies its assessment section and printed page. The pack preserves the distinction between low general utility and no possible benefit. It does not promise marks or an individual result.
- Learning-style matching: [Pashler et al., full paper](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/07/Pashler_McDaniel_Rohrer_Bjork_2009_PSPI.pdf) and [Clinton-Lisell & Litzinger (2024), full article](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1428732/full). The newer positive pooled finding is retained alongside the authors’ qualified adoption conclusion. Preference and accessibility are not treated as errors.
- Activity: [WHO physical activity](https://www.who.int/news-room/fact-sheets/detail/physical-activity), [CDC adult overview](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html), and [CDC activity examples](https://www.cdc.gov/physical-activity-basics/adding-adults/what-counts.html). The pack uses five general assertions. Chronic-disease adherence claims and personal consistency predictions were removed from the deliverable set. Sources do not guarantee equal gym results.

These six distinct source URLs were opened during review. Evidence notes and section/page locators are in `dist/evidence-packs.js` and delivered claim audits. This is bounded source checking, not an exhaustive literature review or automated entailment proof.

## Validation evidence

**All files named `qa-*-synthetic.json` are fabricated software test inputs and outputs. They are not human pilot sessions, treatment effects or evidence of persuasion efficacy.**

| Browser case | Result | Receipt |
| --- | --- | --- |
| Eligible activity | Six checks pass; five activity claims; approval required; explicit zero after-score; exact seven-day due time; completed receipt identical after refresh | `qa-activity-synthetic.json` |
| Discovery-only headphones/preferences | Parked for non-factual driver, no established past cost and unavailable pack; no belief baseline, condition, claims, delivery or after-score | `qa-parked-synthetic.json` |
| Unsupported reversal | Overbroad walking/gym guarantee has no exact approved support; refusal persists after refresh; no factual brief or claim IDs | `qa-reversal-synthetic.json` |
| Supported learning-style belief | Qualified adoption scepticism preserved; favourable matching finding retained; pre-evidence and after-score both 8; receipt identical after refresh | `qa-supported-synthetic.json` |
| Eligible study case | First reason leaves confidence unchanged; second participant-supplied reason carries the belief; five study units; receipt identical after refresh | `qa-study-synthetic.json` |

Additional observed checks: blank baseline cannot advance; absent approval cannot deliver; unmeasured after-score remains `null`; completed measurement and frozen belief fields are disabled; parked back navigation cannot enter the response path. A regression fixture, `qa-zero-scores-synthetic.json`, records explicit zero pre-evidence and after-scores; it was captured before final source-locator cleanup and is not part of the submission evidence set.

Six Node evidence-library tests pass. They check enabled-topic boundaries, claim metadata, equal claim/word budgets, personalization without text mutation, unsupported/cross-pack refusals, and library immutability. JavaScript syntax and `git diff --check` pass.

At a 390-pixel browser viewport, activity and study record screens show no document horizontal overflow. Desktop and mobile screenshots were captured and inspected. The in-app mobile screenshot is scaled within its capture frame; the full-page capture is included. Physical-phone testing, browser speech recognition and 200% text enlargement have not been verified.

Receipt JSON was exported directly from the visible browser receipt into these files and parsed/checked. The in-app browser did not expose a completed download event, and its clipboard bridge reported a tooling error. **Native download/clipboard behavior remains to be checked in ordinary Chrome.** The static archive packaged successfully with the Sites helper.

## Publishing blocker

The native Sites lookup succeeded, and a short-lived repository credential was obtained without saving it to disk. The required Site synchronization script started, but both attempts to provide its protected stdin input were rejected by automatic approval review: the action requires approval and the current policy disables that approval category. No source push, saved Site version or deployment was performed. Requested filesystem/network grants did not resolve the rejection. No alternative credential channel was used.

The local commit, static deployment archive and source bundle are preserved. The package contains no credentials or participant Downloads.

## Next work, in order

1. Connect the adaptive interviewer to a server endpoint and validate its structured contract. Keep field provenance, eligibility, question budget, freezing, crux-pass limit, claim access, assignment and delivery checks outside the model. The current frontend uses deterministic templates and does not satisfy the model-endpoint requirement.
2. Add durable server sessions, authenticated researcher approval and reproducible blocked assignment if required for the capstone’s claimed scope. Current browser locks are not tamper-resistant and cannot resume across devices.
3. Run real consented activity and parked interviews. Preserve their receipts separately from these QA fixtures. No real participant was recruited or interviewed in this turn.
4. Check native JSON downloads and clipboard in Chrome, physical-phone layout and the chosen voice path. Follow-up collection and links are not implemented; report seven-day follow-up as not yet due.
5. Restore the approved Site synchronization path, push the tested commit, save/deploy the matching archive, verify native deployment success and assemble the actual submission evidence. Publishing remains incomplete.

No automated notifications or recurring jobs were created.
