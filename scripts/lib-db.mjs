// Shared plumbing for the dataset imports.
//
// Every import is idempotent: rows are upserted on a natural key, so
// running a script twice updates in place and never duplicates. That is
// what makes these safe to re-run after a partial failure, which on a
// 367,000-row table is not a hypothetical.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, "..");
export const DATA = join(here, ".data");

/** Read .env.local without adding a dependency for it. */
function loadEnv() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

export function db() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export const DRY = process.argv.includes("--dry-run");

/**
 * Upsert in batches.
 *
 * One statement for a third of a million rows is a request nobody should
 * send and PostgREST would refuse anyway. These go up in slices, with the
 * count reported as they land so a long import is legible while it runs.
 */
export async function upsertBatched(client, table, rows, onConflict, batchSize = 1000) {
  if (DRY) {
    console.log(`  [dry run] ${table}: ${rows.length} rows parsed, nothing written`);
    return rows.length;
  }
  let done = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    const { error } = await client.from(table).upsert(slice, { onConflict, ignoreDuplicates: false });
    if (error) {
      throw new Error(`${table} batch at ${i}: ${error.message}`);
    }
    done += slice.length;
    if (done % 20000 === 0 || done === rows.length) {
      process.stdout.write(`\r  ${table}: ${done}/${rows.length}`);
    }
  }
  process.stdout.write("\n");
  return done;
}

/** Row count straight from the table, for the report. */
export async function countRows(client, table) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}
