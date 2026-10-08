-- Carry the participant's plain-language answers forward so the baseline
-- snapshot can be frozen without re-asking scope/time or consequence detail.
alter table eligibility_evaluations add column scope_and_time text;
alter table eligibility_evaluations add column consequence_occurred boolean;
alter table eligibility_evaluations add column consequence_evidence text;
