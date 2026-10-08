-- Table-level GRANTs. RLS (0002) is the actual row-level gate; these grants
-- just ensure service_role (server-only; bypasses RLS) can act at all, and
-- future tables get the same grants automatically.
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;
