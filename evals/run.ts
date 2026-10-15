import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { selfPromotionSchema } from "../lib/subreddits.ts";
import { classifyPolicy } from "../scripts/cli.ts";

async function main() {
  const { values } = parseArgs({
    options: { help: { type: "boolean", short: "h" } },
    allowPositionals: false,
  });
  if (values.help) {
    console.log(`Usage: pnpm evals

Run saved self-promotion cases against the live ingestion classifier.
Uses Doppler web/dev and makes paid Jev and conditional DeepSeek API calls.
Does not scrape pages or read/write the database. Not run by lint or build.

Examples:
  pnpm evals
  pnpm evals --help

Output: JSON lines with expected/actual status, confidence, and generated detail,
followed by totals. Exit 1 on any mismatch or API error.`);
    return;
  }

  const cases = z
    .array(
      z.object({
        name: z.string().min(1),
        source: z.string().min(1),
        expected: selfPromotionSchema,
        rules: z.array(
          z.object({ title: z.string(), description: z.string().nullable() }),
        ),
      }),
    )
    .min(1)
    .parse(
      JSON.parse(
        await readFile(
          new URL("./self-promotion.json", import.meta.url),
          "utf8",
        ),
      ),
    );
  const { env } = await import("../lib/env.ts");
  let passed = 0;
  for (const example of cases) {
    try {
      const result = await classifyPolicy(
        example.name,
        { rules: example.rules },
        env.VERCEL_AI_GATEWAY,
      );
      const pass = result.self_promotion === example.expected;
      if (pass) passed++;
      console.log(
        JSON.stringify({
          name: example.name,
          pass,
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
