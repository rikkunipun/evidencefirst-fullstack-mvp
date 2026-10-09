-- Tier 2 item 8: separate "is this brief accurate and in scope" from "how
-- does the evidence relate to the participant's claim" instead of one
-- conflated dropdown. Additive: approvals stays append-only (its
-- block-update trigger is untouched); old rows keep their exact old
-- disposition values, which remain valid under the expanded check.
alter table approvals add column if not exists brief_accurate boolean;
alter table approvals add column if not exists evidence_relation text;
alter table approvals add constraint approvals_evidence_relation_check
  check (evidence_relation is null or evidence_relation in ('supports', 'qualifies', 'contradicts', 'unresolved', 'outside_scope'));

-- 'contradicts' and 'outside_scope' are new possible values for
-- disposition going forward (still written for any existing reader of
-- that column); the four original values remain valid for old rows.
alter table approvals drop constraint approvals_disposition_check;
alter table approvals add constraint approvals_disposition_check
  check (disposition in ('supported', 'qualifies', 'unsupported', 'needs_clarification', 'contradicts', 'outside_scope'));
