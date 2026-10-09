# Deferred — not touched in the Oct 9 pre-pilot repair pass

Per explicit instruction: only the P0 list from `EvidenceFirst_Fullstack_Live_Audit_Oct9.md` was worked today, in order, with a commit after each item. These items from the audit are real and worth doing, but are intentionally deferred:

- **Semantic review taxonomy** (audit §3): replace the researcher's supports/qualifies/unsupported/needs-clarification default-to-Supported dropdown with a required supports / qualifies / contradicts / unresolved / outside-scope choice, no default, plus a controlled clarification step instead of terminal refusal. This is a real researcher-workflow redesign, not a bug fix — out of scope for a pre-pilot patch.
- **Multi-session resume** (audit §5): the single `ef_session` cookie holds one session; starting a new session overwrites it and the earlier session's URL falls back to consent. Needs either multiple capability cookies or a session-switcher, which is new surface area.
- **Expanded receipts** (audit §8): claim/scope versions, gate/rule versions, crux details, approval disposition, immutable evidence versions, and full provenance in the JSON receipt. The current receipt is accurate but a summary, not the complete trace the audit wants.
- **Staging database**: all work today ran against the same Supabase project used for the live pilots (there is no separate staging project in this capstone's resources). A real staging environment is infrastructure, not a code change.
- **Full race-condition suite** (audit §6): approval/delivery and post-score/follow-up are sequential writes with a state check afterward, not wrapped in a single transaction; a withdrawal or concurrent retry during that window could leave a partial write. Needs transactions/row locks and a dedicated concurrency test harness — explicitly called out in the audit as needing staging, not production, to exercise safely.
- **Entailment-grade provenance** (audit §7): current provenance checks that a cited message ID exists in this turn's input, not that the extracted fact is actually entailed by an exact quote span from that message. Tightening this changes the AI contract shape (adding quote spans) and is a larger change than today's window allows.
- **Classifier-failure routing** (audit §7): on a crux classification failure, the route currently parks rather than returning to researcher review as its own fallback rationale implies. Noted, not fixed today.
- **Service-failure vs. substantive-parking distinction** (audit §7): a transient provider error and a genuine "this isn't checkable" parking currently produce similar-looking park outcomes to the participant. Needs a distinct UI/receipt treatment.
- **Explicit token/spend limits** (audit §7): output-token caps, persistent rate limits, and real token/spend logging beyond the per-turn latency logging added today. The question-budget cap is not a spending cap.
- **Review-state persistence across refresh** (audit §4): the researcher's source map / review-in-progress state currently disappears on refresh.

## What today's P0 pass explicitly did NOT do (per the owner's rules)

- No production records deleted — all audit fixtures were marked `is_test=true` and kept.
- No password rotations beyond what was already in progress before this session.
- No secrets printed.
- No new evidence packs added.
- No visual/UX redesign — only the specific fixes listed as P0.
