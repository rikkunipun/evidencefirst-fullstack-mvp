import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv, adminEmailAllowlist } from "../env";

/**
 * Supabase Auth client bound to the incoming request's cookies, used only
 * for researcher login. Participants never get a Supabase Auth session.
 */
export async function createAdminSupabaseClient() {
  const cookieStore = await cookies();
  const env = getEnv();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render; middleware refreshes the session instead.
        }
      },
    },
  });
}

export interface AuthorizedResearcher {
  email: string;
  userId: string;
}

/**
 * Verifies a real Supabase Auth session AND that the email is on the
 * server-side ADMIN_EMAILS allowlist. Every researcher API route must call
 * this itself — it is not sufficient to gate only the dashboard layout.
 */
export async function requireResearcher(): Promise<AuthorizedResearcher | null> {
  const supabase = await createAdminSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  const email = data.user.email.toLowerCase();
  if (!adminEmailAllowlist().includes(email)) return null;
  return { email, userId: data.user.id };
}
