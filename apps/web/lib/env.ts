import { z } from "zod";

/**
 * Every environment variable the server actually reads, validated once at
 * module load. Missing provider credentials must fail loudly here, not
 * produce a fabricated successful AI interview later.
 */
const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_TEXT_MODEL: z.string().min(1),
  ADMIN_EMAILS: z.string().min(1),
  SESSION_TOKEN_SECRET: z.string().min(16, "SESSION_TOKEN_SECRET must be at least 16 characters"),
  /** Item 7: default "auto" in this build — the manual researcher-review
   * flow (approve route, admin review UI) stays fully intact as a
   * fallback; set to "manual" to use it. Not deployed/switched in
   * production until explicitly told to. */
  DELIVERY_MODE: z.enum(["auto", "manual"]).default("auto"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Lazily validated so unit tests that don't touch the network never need real secrets. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid or missing environment variables: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function adminEmailAllowlist(): string[] {
  return getEnv()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
