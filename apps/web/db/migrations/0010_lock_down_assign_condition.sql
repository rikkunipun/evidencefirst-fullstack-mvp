-- assign_condition is SECURITY DEFINER (runs with the owning role's
-- privileges, bypassing the caller's RLS). Postgres grants EXECUTE on new
-- functions to PUBLIC by default, and migrations 0007/0008 never revoked
-- that — so the anon/authenticated keys (which are public, embedded in the
-- browser) could have called a privilege-escalating function directly over
-- PostgREST. Lock it down to the backend role only, and pin search_path so
-- a SECURITY DEFINER function can't be tricked by a hostile schema order.
revoke execute on function assign_condition(uuid, text, text, text, int) from public;
revoke execute on function assign_condition(uuid, text, text, text, int) from anon;
revoke execute on function assign_condition(uuid, text, text, text, int) from authenticated;
grant execute on function assign_condition(uuid, text, text, text, int) to service_role;
alter function assign_condition(uuid, text, text, text, int) set search_path = public, pg_temp;
