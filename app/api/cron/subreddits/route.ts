import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { subredditUrlSchema } from "@/lib/subreddits";
import { createAdminClient } from "@/lib/supabase/admin-server";
import { ingestSubreddits } from "@/scripts/cli";

export const maxDuration = 800;

export async function GET(request: Request) {
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = createAdminClient(env);
  const { data, error } = await db.rpc("get_subreddits_due_for_refresh", {
    p_limit: 350,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const results = await ingestSubreddits(
    data.map(({ name }) =>
      subredditUrlSchema.parse(`https://www.reddit.com/r/${name}/`),
    ),
    env,
    { command: "update", signal: AbortSignal.timeout(740_000) },
  );
  return Response.json(
    { results },
    { status: results.some(({ status }) => status === "failed") ? 500 : 200 },
  );
}
