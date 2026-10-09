-- Automatic delivery (removing the mandatory human-review dependency).
-- All additive/nullable — existing rows and the manual flow are
-- unaffected; DELIVERY_MODE=manual keeps using the existing approve route
-- untouched.

-- Item 8: consent version stored on the session itself (not only
-- consent_events), so later researcher audit/export can read it directly
-- off the session row.
alter table sessions add column if not exists consent_version text;

-- Item 7: a snapshot of which mode produced this session, for audit
-- clarity if the env var changes over the study's lifetime.
alter table sessions add column if not exists delivery_mode text;

-- Item 3: the validated claim-kind classification result, once resolved
-- (a real kind id, or 'none'). Null until classification runs.
alter table sessions add column if not exists claim_kind text;

-- Item 3's one bounded clarification: the fixed question asked (if the
-- first classification attempt was "unclear"), and whether it's already
-- been asked once (so a second "unclear" always falls through to the
-- non-delivery message, never a second clarification).
alter table sessions add column if not exists claim_kind_clarification_question text;
alter table sessions add column if not exists claim_kind_clarification_asked boolean not null default false;

-- Item 6: record automatic decisions as system validation, never a human
-- reviewer field. reviewer_email becomes nullable (null exactly when
-- is_system is true); policy/pack/template versions and check results are
-- captured on the decision record itself.
alter table approvals alter column reviewer_email drop not null;
alter table approvals add column if not exists is_system boolean not null default false;
alter table approvals add column if not exists policy_version text;
alter table approvals add column if not exists pack_version text;
alter table approvals add column if not exists check_results jsonb;
alter table approvals add constraint approvals_system_xor_reviewer
  check ((is_system and reviewer_email is null) or (not is_system and reviewer_email is not null));

-- Item 5: atomic, idempotent auto-delivery. Re-checks withdrawal, expected
-- state, and expected revision inside the same transaction as the
-- approval + delivery inserts + state transition — a concurrent
-- withdrawal or a stale/duplicate caller can never produce a partial or
-- double delivery. Idempotent: if a delivery already exists for this
-- session, returns it instead of erroring (safe to retry).
create or replace function auto_deliver_session(
  p_session_id uuid,
  p_expected_state text,
  p_expected_revision int,
  p_draft_revision_id uuid,
  p_claim_kind text,
  p_legacy_disposition text,
  p_evidence_relation text,
  p_policy_version text,
  p_pack_version text,
  p_template_version text,
  p_check_results jsonb,
  p_exact_text text,
  p_exact_html text,
  p_claim_ids text[],
  p_source_map jsonb,
  p_boundary_text text,
  p_content_hash text
) returns table(approval_id uuid, already_delivered boolean) as $$
declare
  v_session record;
  v_existing_approval_id uuid;
  v_new_approval_id uuid;
begin
  select d.approval_id into v_existing_approval_id from deliveries d where d.session_id = p_session_id;
  if found then
    approval_id := v_existing_approval_id;
    already_delivered := true;
    return next;
    return;
  end if;

  select * into v_session from sessions where id = p_session_id for update;
  if not found then
    raise exception 'session % not found', p_session_id;
  end if;
  if v_session.withdrawn_at is not null then
    raise exception 'session % was withdrawn; cannot deliver', p_session_id;
  end if;
  if v_session.state <> p_expected_state then
    raise exception 'session % is in state % not the expected %', p_session_id, v_session.state, p_expected_state;
  end if;
  if v_session.revision <> p_expected_revision then
    raise exception 'session % revision % does not match expected % (stale)', p_session_id, v_session.revision, p_expected_revision;
  end if;

  insert into approvals (
    draft_revision_id, reviewer_email, disposition, brief_accurate, evidence_relation,
    scope_justification, content_hash, is_system, policy_version, pack_version, template_version, check_results
  ) values (
    p_draft_revision_id, null, p_legacy_disposition, true, p_evidence_relation,
    'Automatic system validation — see check_results.', p_content_hash, true, p_policy_version, p_pack_version, p_template_version, p_check_results
  ) returning id into v_new_approval_id;

  insert into deliveries (session_id, approval_id, exact_text, exact_html, claim_ids, source_map, boundary_text, template_version, content_hash)
  values (p_session_id, v_new_approval_id, p_exact_text, p_exact_html, p_claim_ids, p_source_map, p_boundary_text, p_template_version, p_content_hash);

  update sessions set state = 'delivered', revision = revision + 1, claim_kind = p_claim_kind where id = p_session_id;

  approval_id := v_new_approval_id;
  already_delivered := false;
  return next;
end;
$$ language plpgsql security definer;

revoke execute on function auto_deliver_session(uuid, text, int, uuid, text, text, text, text, text, text, jsonb, text, text, text[], jsonb, text, text) from public;
revoke execute on function auto_deliver_session(uuid, text, int, uuid, text, text, text, text, text, text, jsonb, text, text, text[], jsonb, text, text) from anon;
revoke execute on function auto_deliver_session(uuid, text, int, uuid, text, text, text, text, text, text, jsonb, text, text, text[], jsonb, text, text) from authenticated;
grant execute on function auto_deliver_session(uuid, text, int, uuid, text, text, text, text, text, text, jsonb, text, text, text[], jsonb, text, text) to service_role;
alter function auto_deliver_session(uuid, text, int, uuid, text, text, text, text, text, text, jsonb, text, text, text[], jsonb, text, text) set search_path = public, pg_temp;
