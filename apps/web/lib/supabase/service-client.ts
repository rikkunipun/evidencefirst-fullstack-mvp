import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../env";

/**
 * Service-role Supabase client. Server-only, bypasses RLS entirely — every
 * route handler that uses this MUST independently authorize the request
 * (capability cookie -> session ownership, or Supabase Auth + ADMIN_EMAILS
 * allowlist). Never import this from a Client Component.
 */
let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (client) return client;
  const env = getEnv();
  client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
