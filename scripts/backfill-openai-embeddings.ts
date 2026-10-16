import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import {
  descriptionEmbeddingText,
  embedDescription,
} from "../lib/ai/embeddings.ts";
import type { Database } from "../types/database.types.ts";

// Run with the target environment loaded. Dry-run by default; --apply writes
// only the new vector column on the exact existing description snapshot.
const { values } = parseArgs({ options: { apply: { type: "boolean" } } });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.VERCEL_AI_GATEWAY;
if (!url || !key || !apiKey)
  throw new Error("Supabase and Gateway credentials are required.");
const db = createClient<Database>(url, key, {
  auth: { persistSession: false },
});
const pageSize = 100;
const names = new Map<string, string>();
for (let offset = 0; ; offset += pageSize) {
  const { data, error } = await db
    .from("subreddits")
    .select("id,name")
    .order("id")
    .range(offset, offset + pageSize - 1);
  if (error) throw error;
  for (const row of data) names.set(row.id, row.name);
  if (data.length < pageSize) break;
}
type Snapshot = Pick<
  Database["public"]["Tables"]["subreddit_descriptions"]["Row"],
  "subreddit_id" | "created_at" | "description" | "description_embedding_openai"
>;
const latest = new Map<string, Snapshot>();
for (let offset = 0; ; offset += pageSize) {
  const { data, error } = await db
    .from("subreddit_descriptions")
    .select("subreddit_id,created_at,description,description_embedding_openai")
    .order("subreddit_id")
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);
  if (error) throw error;
  for (const row of data)
    if (!latest.has(row.subreddit_id)) latest.set(row.subreddit_id, row);
  if (data.length < pageSize) break;
}
const pending = [...latest.values()].filter(
  (row) =>
    row.description !== null && row.description_embedding_openai === null,
);
console.log(
  JSON.stringify({
    target: new URL(url).host,
    apply: !!values.apply,
    latestSnapshots: latest.size,
    pending: pending.length,
  }),
);
if (values.apply) {
  let next = 0;
  let saved = 0;
  let skipped = 0;
  let failed = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < pending.length) {
        const row = pending[next++];
        const name = names.get(row.subreddit_id);
        if (!name || row.description === null)
          throw new Error("Missing snapshot identity.");
        try {
          const vector = await embedDescription(
            descriptionEmbeddingText(name, row.description),
            "RETRIEVAL_DOCUMENT",
            apiKey,
          );
          const { data, error } = await db
            .from("subreddit_descriptions")
            .update({ description_embedding_openai: JSON.stringify(vector) })
            .eq("subreddit_id", row.subreddit_id)
            .eq("created_at", row.created_at)
            .eq("description", row.description)
            .is("description_embedding_openai", null)
            .select("subreddit_id");
          if (error) throw error;
          if (data.length === 1) saved++;
          else skipped++;
        } catch {
          failed++;
          console.error(
            `Failed to embed ${name}; rerun to retry remaining snapshots.`,
          );
        }
      }
    }),
  );
  console.log(JSON.stringify({ saved, skipped, failed }));
  if (failed || skipped) process.exitCode = 1;
  // Recheck current rows to catch a refresh that happened during the backfill.
  const { count, error } = await db
    .from("current_subreddits")
    .select("id", { count: "exact", head: true })
    .not("description", "is", null)
    .is("description_embedding_openai", null);
  if (error) throw error;
  console.log(JSON.stringify({ currentRowsStillMissing: count }));
  if (count) process.exitCode = 1;
}
