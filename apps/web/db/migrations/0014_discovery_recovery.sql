-- Repairs the "candidate_ready but validated core fields missing" path.
-- Fields are additive and nullable/defaulted, so old rows/receipts remain
-- valid without a backfill.
--
-- discovery_repair_used: true once we've already spent the one bounded
--   repair (a neutral missing-field question) for the current extraction
--   gap. Reset to false as soon as a turn makes real progress again, so a
--   later unrelated gap gets its own one-shot repair.
-- discovery_recovery_reason: set only when the bounded repair also failed.
--   Session stays in state 'discovery' — this is deliberately distinct
--   from park_reason (substantive parking) in state, researcher view,
--   receipts and exports, none of which read this column.
-- needs_researcher_review: participant-requested flag from the recovery
--   screen ("ask for researcher review"), surfaced in the admin view only.
alter table sessions add column if not exists discovery_repair_used boolean not null default false;
alter table sessions add column if not exists discovery_recovery_reason text;
alter table sessions add column if not exists needs_researcher_review boolean not null default false;

-- Structural-only diagnostics (field names, booleans, counts) for
-- researchers — never raw transcript text. Null for historical rows.
alter table extraction_snapshots add column if not exists validation_diagnostics jsonb;
