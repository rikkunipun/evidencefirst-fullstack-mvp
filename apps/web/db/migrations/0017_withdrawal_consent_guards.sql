-- Tier 2 item 11 (partial): check current consent at the commit point for
-- delivery and post-measurement writes, atomically. App-level
-- re-fetch-then-write has an inherent race window between the two
-- queries; a BEFORE INSERT trigger checks withdrawal status in the same
-- statement/transaction as the write itself, closing that window
-- entirely rather than narrowing it. Double-measurement is already
-- structurally prevented by the existing unique(session_id, phase)
-- constraint + block-update trigger (0001_init.sql) — this migration
-- only adds the withdrawal check neither of those covered.
create or replace function ef_block_if_session_withdrawn() returns trigger as $$
declare
  withdrawn timestamptz;
begin
  select withdrawn_at into withdrawn from sessions where id = new.session_id;
  if withdrawn is not null then
    raise exception 'Session % was withdrawn; cannot write to %', new.session_id, tg_table_name;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger deliveries_block_if_withdrawn before insert on deliveries
  for each row execute function ef_block_if_session_withdrawn();

create trigger measurements_block_if_withdrawn before insert on measurements
  for each row execute function ef_block_if_session_withdrawn();
