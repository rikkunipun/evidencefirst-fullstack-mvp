-- EvidenceFirst fullstack-mvp schema.
-- Append-only tables are enforced with a BEFORE UPDATE trigger that raises;
-- a "new version" is always a new row, never an in-place edit.
create extension if not exists pgcrypto;

create or replace function ef_block_update() returns trigger as $$
begin
  raise exception 'Row in % is immutable; insert a new row instead of updating id=%', TG_TABLE_NAME, old.id;
end;
$$ language plpgsql;

create or replace function ef_block_update_if_collected() returns trigger as $$
begin
  if old.collected_at is not null then
    raise exception 'Follow-up % already collected; cannot be edited', old.id;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function ef_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- participants ---------------------------------------------------------
create table participants (
  id uuid primary key default gen_random_uuid(),
  participant_code text not null unique,
  created_at timestamptz not null default now()
);

-- sessions ---------------------------------------------------------------
create table sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id),
  state text not null default 'consented',
  revision integer not null default 0,
  pack_topic text,
  locale text not null default 'en-IN',
  input_mode text not null default 'text',
  app_version text not null default 'fullstack-mvp-0.1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  withdrawal_reason text
);
create trigger sessions_touch before update on sessions
  for each row execute function ef_touch_updated_at();
create index sessions_participant_id_idx on sessions(participant_id);
create index sessions_state_idx on sessions(state);

create table session_capabilities (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  kind text not null check (kind in ('resume', 'followup')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index session_capabilities_session_id_idx on session_capabilities(session_id);

create table consent_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  consent_version text not null,
  consented_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  withdrawal_reason text
);

create table context_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  situation_card text not null,
  goal text,
  decision_cue text,
  free_text text,
  card_order jsonb,
  created_at timestamptz not null default now()
);

-- discovery ---------------------------------------------------------------
create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  turn_number integer not null,
  role text not null check (role in ('participant', 'assistant', 'system')),
  input_mode text not null default 'text' check (input_mode in ('text', 'voice')),
  content text not null,
  created_at timestamptz not null default now(),
  unique (session_id, turn_number, role)
);
create index messages_session_id_idx on messages(session_id);

create table extraction_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  message_id uuid references messages(id),
  fields jsonb not null,
  field_evidence jsonb not null,
  candidate_driver text not null,
  should_stop boolean not null default false,
  stop_reason text,
  safety text not null default 'in_scope',
  prompt_version text not null,
  model text not null,
  request_id text,
  latency_ms integer,
  fallback boolean not null default false,
  error jsonb,
  created_at timestamptz not null default now()
);
create index extraction_snapshots_session_id_idx on extraction_snapshots(session_id);

create table belief_confirmations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  revision integer not null,
  generated_wording text not null,
  confirmed_wording text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, revision)
);
create index belief_confirmations_session_id_idx on belief_confirmations(session_id);

-- eligibility ---------------------------------------------------------------
create table eligibility_evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  belief_confirmation_id uuid not null references belief_confirmations(id),
  current_status text not null check (current_status in ('pass', 'fail', 'unknown')),
  specific_status text not null check (specific_status in ('pass', 'fail', 'unknown')),
  causal_status text not null check (causal_status in ('pass', 'fail', 'unknown')),
  consequential_status text not null check (consequential_status in ('pass', 'fail', 'unknown')),
  checkable_status text not null check (checkable_status in ('pass', 'fail', 'unknown')),
  safe_status text not null check (safe_status in ('pass', 'fail', 'unknown')),
  reasons jsonb not null,
  rules_version text not null,
  disposition text not null check (disposition in ('eligible', 'parked')),
  created_at timestamptz not null default now()
);
create trigger eligibility_evaluations_block_update before update on eligibility_evaluations
  for each row execute function ef_block_update();
create index eligibility_evaluations_session_id_idx on eligibility_evaluations(session_id);

-- baseline / crux -----------------------------------------------------------
create table baseline_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions(id),
  belief_wording text not null,
  scope_and_time text not null,
  consequence_text text,
  consequence_evidence text,
  baseline_score integer not null check (baseline_score between 0 and 10),
  frozen_at timestamptz not null default now()
);
create trigger baseline_snapshots_block_update before update on baseline_snapshots
  for each row execute function ef_block_update();

create table crux_passes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  pass_number integer not null check (pass_number in (1, 2)),
  stated_reason text not null,
  confirmed_reason text,
  hypothetical_score integer check (hypothetical_score between 0 and 10),
  created_at timestamptz not null default now(),
  unique (session_id, pass_number)
);
create index crux_passes_session_id_idx on crux_passes(session_id);

create table crux_classifications (
  id uuid primary key default gen_random_uuid(),
  crux_pass_id uuid not null references crux_passes(id),
  classification text not null check (
    classification in ('current_claim', 'near_term_test', 'distant_forecast', 'value_identity', 'unclear')
  ),
  created_at timestamptz not null default now()
);
create trigger crux_classifications_block_update before update on crux_classifications
  for each row execute function ef_block_update();

create table measurements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  phase text not null check (phase in ('pre_evidence', 'post_evidence')),
  score integer not null check (score between 0 and 10),
  explanation text,
  reported_behavior text,
  recorded_at timestamptz not null default now(),
  unique (session_id, phase)
);
create trigger measurements_block_update before update on measurements
  for each row execute function ef_block_update();
create index measurements_session_id_idx on measurements(session_id);

-- evidence library ------------------------------------------------------
create table evidence_units (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null,
  pack_version text not null,
  claim_id text not null,
  claim_text text not null,
  source_id text not null,
  source_title text not null,
  source_url text not null,
  locator text not null,
  evidence_note text not null,
  tags text[] not null default '{}',
  audit_status text not null default 'source_checked',
  audit_date date not null,
  enabled boolean not null default true,
  scope text not null,
  boundary text not null,
  created_at timestamptz not null default now(),
  unique (pack_id, pack_version, claim_id)
);
create trigger evidence_units_block_update before update on evidence_units
  for each row execute function ef_block_update();
create index evidence_units_pack_idx on evidence_units(pack_id, pack_version);

-- assignment --------------------------------------------------------------
create table assignment_blocks (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null,
  pack_version text not null,
  protocol_version text not null,
  sequence jsonb not null,
  algorithm_version text not null,
  created_at timestamptz not null default now(),
  unique (pack_id, pack_version, protocol_version, id)
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions(id),
  pack_id text not null,
  pack_version text not null,
  protocol_version text not null,
  block_id uuid not null references assignment_blocks(id),
  block_position integer not null,
  condition text not null check (condition in ('fixed', 'personalized')),
  assigned_at timestamptz not null default now()
);
create trigger assignments_block_update before update on assignments
  for each row execute function ef_block_update();

-- draft / approval / delivery ----------------------------------------------
create table draft_revisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  assignment_id uuid not null references assignments(id),
  claim_order text[] not null,
  rendered_text text not null,
  rendered_html text not null,
  word_count integer not null,
  content_hash text not null,
  template_version text not null,
  created_at timestamptz not null default now()
);
create trigger draft_revisions_block_update before update on draft_revisions
  for each row execute function ef_block_update();
create index draft_revisions_session_id_idx on draft_revisions(session_id);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  draft_revision_id uuid not null references draft_revisions(id),
  reviewer_email text not null,
  disposition text not null check (disposition in ('supported', 'qualifies', 'unsupported', 'needs_clarification')),
  scope_justification text not null,
  content_hash text not null,
  approved_at timestamptz not null default now()
);
create trigger approvals_block_update before update on approvals
  for each row execute function ef_block_update();

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions(id),
  approval_id uuid not null references approvals(id),
  exact_text text not null,
  exact_html text not null,
  claim_ids text[] not null,
  source_map jsonb not null,
  boundary_text text not null,
  template_version text not null,
  content_hash text not null,
  delivered_at timestamptz not null default now(),
  displayed_ack_at timestamptz
);
create trigger deliveries_block_update before update on deliveries
  for each row execute function ef_block_update();

-- follow-up -----------------------------------------------------------------
create table followups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions(id),
  due_at timestamptz not null,
  token_hash text not null unique,
  collected_at timestamptz,
  score integer check (score between 0 and 10),
  reported_behavior text,
  other_influences text,
  created_at timestamptz not null default now()
);
create trigger followups_block_update_if_collected before update on followups
  for each row execute function ef_block_update_if_collected();

-- reversal QA (independent of participant sessions/denominators) -----------
create table reversal_runs (
  id uuid primary key default gen_random_uuid(),
  reviewer_email text not null,
  pack_id text,
  submitted_claim text not null,
  supported boolean not null,
  matched_claim_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- audit -----------------------------------------------------------------
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('system', 'model', 'researcher', 'participant')),
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_entity_idx on audit_events(entity_type, entity_id);
