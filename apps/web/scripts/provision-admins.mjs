// Dev-only: creates/updates a Supabase Auth user for each ADMIN_EMAILS entry
// with a freshly generated password, printed ONLY to this terminal (never
// written to a file, never committed). Re-run any time to rotate passwords.
import path from "node:path";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (adminEmails.length === 0) {
  console.error("ADMIN_EMAILS is empty in .env.local — add at least one researcher email first.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

for (const email of adminEmails) {
  const password = randomBytes(12).toString("base64url");
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error(`listUsers failed: ${listErr.message}`);
    process.exit(1);
  }
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (error) {
      console.error(`Failed to update ${email}: ${error.message}`);
      continue;
    }
    console.log(`Updated password for ${email}: ${password}`);
  } else {
    const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) {
      console.error(`Failed to create ${email}: ${error.message}`);
      continue;
    }
    console.log(`Created ${email} with password: ${password}`);
  }
}

console.log("\nLog in at /admin/login with the email + password shown above. These are not stored anywhere by this script.");
