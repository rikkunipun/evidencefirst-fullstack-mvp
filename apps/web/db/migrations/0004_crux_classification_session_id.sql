-- Denormalize session_id onto crux_classifications so "latest classification
-- for this session" doesn't require joining through crux_passes. Table is
-- empty so far (no app code has written to it yet), so NOT NULL is safe.
alter table crux_classifications add column session_id uuid references sessions(id);
alter table crux_classifications alter column session_id set not null;
create index crux_classifications_session_id_idx on crux_classifications(session_id);
