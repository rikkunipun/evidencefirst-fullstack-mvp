-- Bugfix found via live e2e test (2026-10-09): migration 0018's
-- auto_deliver_session() function inserts into approvals.template_version,
-- but that column was never added — only draft_revisions had it. Every
-- real auto-delivery attempt failed with "column template_version of
-- relation approvals does not exist" until this.
alter table approvals add column if not exists template_version text;
