-- Atomic, idempotent 1:1 permuted-block assignment. Runs as one statement
-- (one implicit transaction), with `for update` serializing concurrent
-- callers against the same pack/version/protocol block so no two sessions
-- can ever consume the same slot.
create or replace function assign_condition(
  p_session_id uuid,
  p_pack_id text,
  p_pack_version text,
  p_protocol_version text,
  p_block_size int default 10
) returns table(condition text, block_position int, block_id uuid) as $$
declare
  v_block record;
  v_existing record;
  v_sequence jsonb;
  v_position int;
  v_condition text;
begin
  select a.condition as cond, a.block_position as pos, a.block_id as bid into v_existing
  from assignments a where a.session_id = p_session_id;
  if found then
    condition := v_existing.cond;
    block_position := v_existing.pos;
    block_id := v_existing.bid;
    return next;
    return;
  end if;

  select * into v_block from assignment_blocks
    where pack_id = p_pack_id and pack_version = p_pack_version and protocol_version = p_protocol_version
    order by created_at desc limit 1
    for update;

  if not found then
    select jsonb_agg(val order by rnd) into v_sequence
    from (
      select val, random() as rnd
      from unnest(array_cat(array_fill('fixed'::text, array[p_block_size/2]), array_fill('personalized'::text, array[p_block_size/2]))) as val
    ) s;
    insert into assignment_blocks (pack_id, pack_version, protocol_version, sequence, algorithm_version)
    values (p_pack_id, p_pack_version, p_protocol_version, v_sequence, 'permuted-block-v1')
    returning * into v_block;
  end if;

  select count(*) into v_position from assignments where block_id = v_block.id;

  if v_position >= jsonb_array_length(v_block.sequence) then
    select jsonb_agg(val order by rnd) into v_sequence
    from (
      select val, random() as rnd
      from unnest(array_cat(array_fill('fixed'::text, array[p_block_size/2]), array_fill('personalized'::text, array[p_block_size/2]))) as val
    ) s;
    insert into assignment_blocks (pack_id, pack_version, protocol_version, sequence, algorithm_version)
    values (p_pack_id, p_pack_version, p_protocol_version, v_sequence, 'permuted-block-v1')
    returning * into v_block;
    v_position := 0;
  end if;

  v_condition := v_block.sequence->>v_position;

  insert into assignments (session_id, pack_id, pack_version, protocol_version, block_id, block_position, condition)
  values (p_session_id, p_pack_id, p_pack_version, p_protocol_version, v_block.id, v_position, v_condition);

  condition := v_condition;
  block_position := v_position;
  block_id := v_block.id;
  return next;
end;
$$ language plpgsql security definer;

grant execute on function assign_condition(uuid, text, text, text, int) to service_role;
