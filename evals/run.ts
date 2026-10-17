import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { policyEvalCasesSchema } from "../lib/schemas/ingestion.ts";
import { classifyPolicy } from "../scripts/cli.ts";

async function main() {
  const { values } = parseArgs({
    options: { help: { type: "boolean", short: "h" } },
    allowPositionals: false,
  });
  if (values.help) {
    console.log(`Usage: pnpm evals

Run saved self-promotion cases against the live ingestion classifier.
Uses Doppler web/dev, or .env.local with pnpm evals:local.
Makes paid Jev and conditional Luna API calls.
Does not scrape pages or read/write the database. Not run by lint or build.

Examples:
  pnpm evals
  pnpm evals --help

Output: JSON lines with expected/actual status, confidence, and generated detail,
followed by totals. Checks statuses, omitted subreddit names, and any saved
summary requirements. Exit 1 on a failed check or API error.`);
    return;
  }

  const cases = policyEvalCasesSchema.parse(
    JSON.parse(
      await readFile(new URL("./self-promotion.json", import.meta.url), "utf8"),
    ),
  );
  const { env } = await import("../lib/config/env.ts");
  let passed = 0;
  for (const example of cases) {
    try {
      const result = await classifyPolicy(
        example.name,
        { rules: example.rules },
        env.VERCEL_AI_GATEWAY,
      );
      const detail = result.self_promotion_detail;
      const failures: string[] = [];
      if (result.self_promotion !== example.expected)
        failures.push("classification");
      const ownName = new RegExp(`\\br/${example.name}\\b`, "i");
      if (ownName.test(detail)) failures.push("subreddit name in summary");
      const checks = example.summaryChecks;
      if (checks) {
        for (const pattern of checks.required) {
          if (!new RegExp(pattern, "i").test(detail))
            failures.push(`missing: ${pattern}`);
        }
        for (const pattern of checks.forbidden) {
          if (new RegExp(pattern, "i").test(detail))
            failures.push(`forbidden: ${pattern}`);
        }
      }
      const pass = failures.length === 0;
      if (pass) passed++;
      console.log(
        JSON.stringify({
          name: example.name,
          pass,
          failures,
          expected: example.expected,
          actual: result.self_promotion,
          confidence: result.self_promotion_confidence,
          detail: result.self_promotion_detail,
        }),
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          name: example.name,
          pass: false,
          expected: example.expected,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
  console.log(
    JSON.stringify({
      total: cases.length,
      passed,
      failed: cases.length - passed,
    }),
  );
  if (passed !== cases.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
