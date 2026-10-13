import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { embedDescription } from "../lib/ai.ts";
import {
  classifyPolicy,
  fetchSubredditBatch,
  normalizeSubredditUrl,
  parseActivity,
  parsePolicy,
  type SubredditTarget,
} from "../lib/subreddit-ingestion.ts";
import type { Database, Json, Tables } from "../types/database.types.ts";

type Command = "add" | "update" | "list";
const commands = new Set(["add", "update", "list"]);
function helpFor(command?: Command) {
  if (!command)
    return `Usage: pnpm --silent subreddits <add|update|list> [options]

add     Insert a subreddit; existing names are a successful no-op.
update  Refresh an existing subreddit.
list    List never-refreshed entries first, then oldest full refreshes.

Examples:
  pnpm --silent subreddits add --help
  pnpm --silent subreddits update --help
  pnpm --silent subreddits list --help
`;
  const options =
    command === "list"
      ? "  --limit N          Maximum entries (default 20, maximum 10000)."
      : `  --url URL          Subreddit URL. Repeat for several communities.
  --input FILE|-     One URL per line from a file or stdin.
  --dry-run          Fetch and classify, but do not write.${command === "update" ? "\n  --activity-only    Save weekly activity without policy or AI calls." : ""}`;
  const examples =
    command === "list"
      ? `  pnpm --silent subreddits list --env dev --limit 20
  pnpm --silent subreddits list --env prod --limit 10000 | jq -r '.url' > /tmp/subreddits.txt`
      : `  pnpm --silent subreddits ${command} --env dev --url https://www.reddit.com/r/apple/
  pnpm --silent subreddits ${command} --env prod --input /tmp/subreddits.txt
  cat /tmp/subreddits.txt | pnpm --silent subreddits ${command} --env dev --input -${command === "update" ? "\n  pnpm --silent subreddits update --env prod --activity-only --input /tmp/subreddits.txt" : ""}`;
  return `Usage: pnpm --silent subreddits ${command} --env dev|prod [options]

Options:
  --env dev|prod      Required. Doppler web/dev or web/prd.
${options}
  --help             Show help without credentials.

Examples:
${examples}

Output: one JSON object per result on stdout; errors on stderr. Exit 1 if any
entry fails; duplicate adds exit 0. Requires Node.js 24+ and Doppler login.
${
  command === "list"
    ? "Lists last_scraped_at, the last successful full processing time.\n"
    : `TinyFish batches contain up to 10 URLs. Full refresh uses two regular pages;
activity-only uses one. Each failed URL is retried once. Cached data is allowed
(24-hour preference, not a guarantee). Blocked/unloaded policy pages do not
replace existing data. Last processing time does not guarantee source freshness.
`
}`;
}

function output(value: unknown) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      env: { type: "string" },
      url: { type: "string", multiple: true },
      input: { type: "string" },
      limit: { type: "string" },
      "activity-only": { type: "boolean" },
      "dry-run": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help || !positionals.length) {
    process.stdout.write(
      helpFor(
        commands.has(positionals[0]) ? (positionals[0] as Command) : undefined,
      ),
    );
    return;
  }
  const command = positionals[0] as Command;
  if (!commands.has(command) || positionals.length !== 1)
    throw new Error(`Unknown command.\n${helpFor()}`);
  if (values.env !== "dev" && values.env !== "prod")
    throw new Error(
      "Set --env dev or --env prod. Example: pnpm --silent subreddits list --env dev",
    );
  if (command !== "list" && values.limit)
    throw new Error("--limit is only supported by list.");
  if (command !== "update" && values["activity-only"])
    throw new Error("--activity-only is only supported by update.");
  if (command === "list" && (values.url || values.input || values["dry-run"]))
    throw new Error("list accepts only --env and --limit.");
  const limit = values.limit === undefined ? 20 : Number(values.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000)
    throw new Error("--limit must be an integer from 1 to 10000.");
  const targets: SubredditTarget[] = [];
  if (command !== "list") {
    const inputs = [...(values.url ?? [])];
    if (values.input) {
      if (values.input === "-") {
        if (process.stdin.isTTY)
          throw new Error(
            "Pipe newline-separated URLs to --input -. Interactive input is not supported.",
          );
        let text = "";
        for await (const chunk of process.stdin) text += chunk;
        inputs.push(
          ...text
            .split(/\r?\n/)
            .filter((line) => line.trim())
            .map((line) => line.trim()),
        );
      } else
        inputs.push(
          ...(await readFile(values.input, "utf8"))
            .split(/\r?\n/)
            .filter((line) => line.trim())
            .map((line) => line.trim()),
        );
    }
    if (!inputs.length)
      throw new Error(
        `Supply --url or --input. Example: pnpm --silent subreddits ${command} --env dev --url https://www.reddit.com/r/apple/`,
      );
    const seen = new Set<string>();
    for (const raw of inputs) {
      const target = normalizeSubredditUrl(raw);
      if (!seen.has(target.name)) {
        seen.add(target.name);
        targets.push(target);
      }
    }
  }
  let secrets: Record<string, string>;
  try {
    secrets = JSON.parse(
      execFileSync(
        "doppler",
        [
          "secrets",
          "download",
          "--no-file",
          "--no-fallback",
          "-p",
          "web",
          "-c",
          values.env === "prod" ? "prd" : "dev",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    );
  } catch {
    throw new Error(
      "Doppler could not load the selected config. Check doppler login and --env.",
    );
  }
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
    if (!secrets[key])
      throw new Error(`${key} is missing from the selected Doppler config.`);
  const db = createClient<Database>(
    secrets.NEXT_PUBLIC_SUPABASE_URL,
    secrets.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  if (command === "list") {
    // PostgREST caps each response; page explicitly so backfills get every row.
    for (let offset = 0; offset < limit; offset += 1000) {
      const take = Math.min(1000, limit - offset);
      const { data, error } = await db
        .from("subreddits")
        .select("id,name,last_scraped_at,weekly_active_users")
        .order("last_scraped_at", { ascending: true, nullsFirst: true })
        .order("id")
        .range(offset, offset + take - 1);
      if (error) throw new Error(error.message);
      for (const row of data)
        output({ ...row, url: `https://www.reddit.com/r/${row.name}/` });
      if (data.length < take) break;
    }
    return;
  }
  let failed = false;
  for (let offset = 0; offset < targets.length; offset += 10) {
    const batch = targets.slice(offset, offset + 10);
    const pending: SubredditTarget[] = [];
    const existing = new Map<string, Tables<"subreddits"> | null>();
    for (const target of batch) {
      const { data, error } = await db
        .from("subreddits")
        .select("*")
        .ilike("name", target.name.replaceAll("_", "\\_"))
        .maybeSingle();
      if (error) throw new Error(error.message);
      existing.set(target.name, data);
      if (command === "add" && data)
        output({ status: "already_exists", id: data.id, url: target.url });
      else if (command === "update" && !data) {
        process.stderr.write(
          `${JSON.stringify({ status: "failed", url: target.url, error: "Subreddit does not exist; use add." })}\n`,
        );
        failed = true;
      } else pending.push(target);
    }
    if (!pending.length) continue;
    if (!secrets.TINYFISH_API_KEY)
      throw new Error(
        "TINYFISH_API_KEY is missing from the selected Doppler config.",
      );
    if (!values["activity-only"] && !secrets.VERCEL_AI_GATEWAY)
      throw new Error(
        "VERCEL_AI_GATEWAY is missing from the selected Doppler config.",
      );
    const activity = await fetchSubredditBatch(
      pending,
      "activity",
      secrets.TINYFISH_API_KEY,
      parseActivity,
    );
    const valid = pending.filter(
      (target) => !(activity.get(target.name) instanceof Error),
    );
    const policies =
      values["activity-only"] || !valid.length
        ? null
        : await fetchSubredditBatch(
            valid,
            "policy",
            secrets.TINYFISH_API_KEY,
            parsePolicy,
          );
    for (const target of pending) {
      try {
        const started = Date.now();
        const stats = activity.get(target.name);
        if (!stats || stats instanceof Error)
          throw stats ?? new Error("Missing activity result.");
        const row = existing.get(target.name);
        if (values["activity-only"]) {
          if (!row) throw new Error("Subreddit does not exist; use add.");
          if (!values["dry-run"]) {
            const { error } = await db
              .from("subreddits")
              .update({ weekly_active_users: stats.weekly_active_users })
              .eq("id", row.id);
            if (error) throw new Error(error.message);
          }
          output({
            status: values["dry-run"] ? "dry_run" : "activity_updated",
            id: row.id,
            url: target.url,
            weekly_active_users: stats.weekly_active_users,
          });
          continue;
        }
        const policy = policies?.get(target.name);
        if (!policy || policy instanceof Error)
          throw policy ?? new Error("Missing policy result.");
        const classification = await classifyPolicy(
          target.name,
          policy,
          secrets.VERCEL_AI_GATEWAY,
        );
        const embedding =
          row?.description === stats.description && row.description_embedding
            ? row.description_embedding
            : JSON.stringify(
                await embedDescription(
                  `${stats.name}: ${stats.description}`,
                  "RETRIEVAL_DOCUMENT",
                  secrets.VERCEL_AI_GATEWAY,
                ),
              );
        const snapshot = {
          ...stats,
          ...classification,
          description_embedding: embedding,
        };
        if (values["dry-run"]) {
          output({
            status: "dry_run",
            url: target.url,
            weekly_active_users: stats.weekly_active_users,
            ...classification,
            rules_count: policy.rules.length,
          });
          continue;
        }
        const { data, error } = await db.rpc("save_subreddit_snapshot", {
          p_mode: command,
          p_snapshot: snapshot as Json,
          p_rules: policy.rules as Json,
        });
        if (error) throw new Error(error.message);
        if (data.length !== 1)
          throw new Error("Database returned an unexpected save result.");
        output({
          status: data[0].outcome,
          id: data[0].subreddit_id,
          url: target.url,
          weekly_active_users: stats.weekly_active_users,
          ...classification,
          duration_ms: Date.now() - started,
        });
      } catch (error) {
        process.stderr.write(
          `${JSON.stringify({ status: "failed", url: target.url, error: message(error) })}\n`,
        );
        failed = true;
      }
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  // Do not serialize errors from credential subprocesses, which can include stdout.
  process.stderr.write(
    `${JSON.stringify({ status: "failed", error: error instanceof Error && "stdout" in error ? "Doppler could not load the selected config. Check doppler login and --env." : message(error) })}\n`,
  );
  process.exitCode = 1;
});
