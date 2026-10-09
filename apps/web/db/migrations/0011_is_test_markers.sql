-- Durable, reversible markers distinguishing synthetic QA/audit fixtures
-- from real consented participant data. No records are deleted; exports
-- default to excluding is_test=true rows instead.
alter table sessions add column is_test boolean not null default false;
alter table sessions add column test_run_id text;
alter table reversal_runs add column is_test boolean not null default false;
alter table reversal_runs add column test_run_id text;

create index sessions_is_test_idx on sessions(is_test);
