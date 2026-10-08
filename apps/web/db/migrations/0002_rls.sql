-- Enable RLS on every table with NO policies for anon/authenticated roles.
-- This is a deny-all backstop: all real reads/writes go through Next.js
-- route handlers using the service-role key (which bypasses RLS), and every
-- route handler independently re-authorizes (capability cookie -> session
-- ownership, or Supabase Auth + ADMIN_EMAILS allowlist). RLS here exists so
-- a leaked anon key, a misconfigured client, or a future direct-client
-- feature can never read or write these tables.
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename in (
    'participants','sessions','session_capabilities','consent_events','context_answers',
    'messages','extraction_snapshots','belief_confirmations','eligibility_evaluations',
    'baseline_snapshots','crux_passes','crux_classifications','measurements',
    'evidence_units','assignment_blocks','assignments','draft_revisions','approvals',
    'deliveries','followups','reversal_runs','audit_events'
  ) loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end $$;
