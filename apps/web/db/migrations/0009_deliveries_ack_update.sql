-- deliveries currently has a blanket BEFORE UPDATE trigger (ef_block_update),
-- but displayed_ack_at is legitimately set once, after the insert, when the
-- participant actually views the delivery. Replace the trigger with one that
-- allows exactly that one transition and blocks every other field change
-- (including re-setting displayed_ack_at once it's already set, and any
-- change to the exact delivered content).
drop trigger if exists deliveries_block_update on deliveries;

create or replace function ef_block_update_except_first_ack() returns trigger as $$
begin
  if old.displayed_ack_at is not null then
    raise exception 'deliveries row % is immutable once acknowledged', old.id;
  end if;
  if new.exact_text is distinct from old.exact_text
    or new.exact_html is distinct from old.exact_html
    or new.claim_ids is distinct from old.claim_ids
    or new.source_map is distinct from old.source_map
    or new.boundary_text is distinct from old.boundary_text
    or new.content_hash is distinct from old.content_hash
    or new.delivered_at is distinct from old.delivered_at
    or new.approval_id is distinct from old.approval_id
    or new.session_id is distinct from old.session_id
  then
    raise exception 'deliveries row % exact content is immutable', old.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger deliveries_block_update_except_first_ack before update on deliveries
  for each row execute function ef_block_update_except_first_ack();
