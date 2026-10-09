-- Tier 2 item 7: separate the past-decision read-back from the exact
-- current empirical claim, so a participant can correct either without
-- the other being silently dragged along as one free-text blob. Purely
-- additive — confirmed_wording/generated_wording (the combined sentence)
-- keep their existing meaning and are still written on every new
-- confirmation, so every downstream reader (eligibility, baseline, crux,
-- delivery, receipts, exports) continues to work unchanged. Old rows have
-- NULL in the four new columns; the UI falls back to the single combined
-- field when they're null (an in-flight session from before this
-- migration).
alter table belief_confirmations add column if not exists generated_decision_narrative text;
alter table belief_confirmations add column if not exists generated_empirical_claim text;
alter table belief_confirmations add column if not exists confirmed_decision_narrative text;
alter table belief_confirmations add column if not exists confirmed_empirical_claim text;
