-- A session can park either straight out of discovery (no stable candidate,
-- unsafe/excluded, budget exhausted) or after the eligibility/crux checks.
-- One column keeps the participant-facing reason available uniformly for
-- the receipt/trace regardless of which stage produced it.
alter table sessions add column park_reason text;
