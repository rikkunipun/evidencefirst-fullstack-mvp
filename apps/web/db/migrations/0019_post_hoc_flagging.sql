-- Item 10: admin stays for inspection, export, and post-hoc flagging only
-- in auto mode. A distinct column from needs_researcher_review (that one
-- is participant-initiated, from the discovery recovery screen) — this
-- one is researcher-initiated, after the fact, on any session.
alter table sessions add column if not exists researcher_flagged boolean not null default false;
alter table sessions add column if not exists researcher_flag_note text;
