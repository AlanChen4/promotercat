import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createQueryEmbeddingLoader,
  descriptionEmbeddingText,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  embedDescription,
  SEMANTIC_MATCH_THRESHOLD,
} from "./embeddings.ts";

test("OpenAI request uses plain text and 1536 dimensions, then normalizes the vector", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      assert.equal(body.dimensions, 1536);
      assert.equal(
        new Headers(init.headers).get("ai-model-id"),
        "openai/text-embedding-3-small",
      );
      assert.ok(
        ["startups", "startups: Build a business"].includes(body.values[0]),
      );
      return Response.json({ embeddings: [[3, 4, ...Array(1534).fill(0)]] });
    },
  );
  assert.equal(EMBEDDING_MODEL, "openai/text-embedding-3-small");
  for (const [text, type] of [
    ["startups", "RETRIEVAL_QUERY"],
    [
      descriptionEmbeddingText("startups", "Build a business"),
      "RETRIEVAL_DOCUMENT",
    ],
  ] as const) {
    const vector = await embedDescription(text, type, "test-key");
    assert.equal(vector.length, 1536);
    assert.equal(vector[0], 0.6);
    assert.equal(vector[1], 0.8);
  }
});

test("rejects a legacy Qwen vector or a zero vector", async (t) => {
  let returned = Array(4096).fill(0.1);
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ embeddings: [returned] }),
  );
  await assert.rejects(
    embedDescription("finance", "RETRIEVAL_QUERY", "test-key"),
    /invalid description embedding/,
  );
  returned = Array(1536).fill(0);
  await assert.rejects(
    embedDescription("finance", "RETRIEVAL_QUERY", "test-key"),
    /invalid description embedding/,
  );
});

test("ignores an incompatible cached vector", async () => {
  let calls = 0;
  const fresh = [1, ...Array(EMBEDDING_DIMENSIONS - 1).fill(0)];
  const load = createQueryEmbeddingLoader({
    cache: () => ({
      get: async () => Array(4096).fill(1 / 64),
      set: async () => {},
    }),
    embed: async () => {
      calls++;
      return fresh;
    },
  });
  assert.deepEqual(await load("finance", "test-key"), fresh);
  assert.equal(calls, 1);
});

test("calibrated cutoff preserves the positive references across the original queries", () => {
  const report = JSON.parse(
    readFileSync(
      new URL("../../evals/search-threshold.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(SEMANTIC_MATCH_THRESHOLD, report.selectedThreshold);
  for (const row of report.references) {
    if (row.expectation === "retain")
      assert.ok(
        Math.max(...row.scores) >= SEMANTIC_MATCH_THRESHOLD,
        `${row.query}: ${row.community}`,
      );
  }
  for (const community of ["stories", "frontend"]) {
    const row = report.references.find(
      (r: { query: string; community: string }) =>
        r.query === "startups" && r.community === community,
    );
    assert.ok(row.best < SEMANTIC_MATCH_THRESHOLD);
  }
});
