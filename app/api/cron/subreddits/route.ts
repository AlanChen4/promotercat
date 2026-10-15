import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getCronEnv } from "@/env-ingestion";
import { ingestSubreddits } from "@/scripts/cli";
import type { Database } from "@/types/database.types";

export const maxDuration = 800;

export async function GET(request: Request) {
  const env = getCronEnv();
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await db.rpc("get_subreddits_due_for_refresh", {
    p_limit: 350,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const results = await ingestSubreddits(
    data.map(({ name }) => ({
      name: name.toLowerCase(),
      url: `https://www.reddit.com/r/${name.toLowerCase()}/`,
    })),
    env,
    { command: "update", signal: AbortSignal.timeout(740_000) },
  );
  return Response.json(
    { results },
    { status: results.some(({ status }) => status === "failed") ? 500 : 200 },
  );
}
