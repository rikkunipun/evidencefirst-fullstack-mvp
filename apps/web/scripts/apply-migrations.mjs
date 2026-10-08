// Dev-only: applies db/migrations/*.sql in order against the real Supabase
// Postgres instance configured in .env.local. Never logs secrets.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

const webDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(webDir, ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
if (!supabaseUrl || !dbPassword) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

const candidates = [
  { label: "direct", host: `db.${projectRef}.supabase.co`, port: 5432, user: "postgres" },
  { label: "pooler-session", host: `aws-0-ap-south-1.pooler.supabase.com`, port: 5432, user: `postgres.${projectRef}` },
  { label: "pooler-transaction", host: `aws-0-ap-south-1.pooler.supabase.com`, port: 6543, user: `postgres.${projectRef}` },
];

const migrationsDir = path.join(webDir, "db", "migrations");
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

async function tryConnect(c) {
  const client = new pg.Client({
    host: c.host,
    port: c.port,
    user: c.user,
    password: dbPassword,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  return client;
}

let client;
let used;
for (const c of candidates) {
  try {
    client = await tryConnect(c);
    used = c.label;
    break;
  } catch (err) {
    console.error(`Connection attempt [${c.label}] failed: ${err.code ?? err.message}`);
  }
}
if (!client) {
  console.error("All connection attempts failed. Check SUPABASE_DB_PASSWORD / network / project region.");
  process.exit(1);
}

console.log(`Connected via [${used}]. Checking ${files.length} migration file(s)...`);

await client.query(`create table if not exists public.schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);`);
const { rows: appliedRows } = await client.query("select filename from public.schema_migrations");
const applied = new Set(appliedRows.map((r) => r.filename));
const pending = files.filter((f) => !applied.has(f));

if (pending.length === 0) {
  console.log("No pending migrations.");
  await client.end();
  process.exit(0);
}

try {
  for (const file of pending) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`-> ${file}`);
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into public.schema_migrations (filename) values ($1)", [file]);
    await client.query("commit");
  }
  console.log(`Applied ${pending.length} migration(s).`);
} catch (err) {
  await client.query("rollback");
  console.error("Migration failed, rolled back:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
