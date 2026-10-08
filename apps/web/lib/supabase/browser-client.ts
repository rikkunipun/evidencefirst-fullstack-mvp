"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Client-side Supabase Auth client, used only on /admin/login. Participants never use this. */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
