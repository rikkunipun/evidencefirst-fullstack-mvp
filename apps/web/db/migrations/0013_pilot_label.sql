-- Optional, nullable, no personal data: a short label a researcher can
-- put on a /participate link (?pilot=sai-teja) to distinguish pilot
-- sessions in the admin lists. Purely additive.
alter table sessions add column pilot_label text;
create index sessions_pilot_label_idx on sessions(pilot_label);
