import assert from "node:assert/strict";
import { test } from "node:test";
import type { RuntimeCache } from "@vercel/functions";
import { EMBEDDING_DIMENSIONS } from "../lib/ai/embeddings.ts";
import {
  createQueryEmbeddingLoader,
  queryEmbeddingCacheKey,
} from "../lib/ai/query-embeddings.ts";
import { normalizeSearchTerms } from "../lib/subreddits/search-terms.ts";

const vector = [1, ...Array<number>(EMBEDDING_DIMENSIONS - 1).fill(0)];

function fixture() {
  const entries = new Map<string, unknown>();
  const writes: { key: string; ttl?: number }[] = [];
  const calls: string[] = [];
  const cache: Pick<RuntimeCache, "get" | "set"> = {
    get: async (key) => entries.get(key) ?? null,
    set: async (key, value, options) => {
      entries.set(key, value);
      writes.push({ key, ttl: options?.ttl });
    },
  };
  const embed = async (term: string) => {
    calls.push(term);
    return vector;
  };
  return { entries, writes, calls, cache, embed };
}

test("comma terms are unordered, case-insensitive, and deduplicated", () => {
  const terms = normalizeSearchTerms(" Marketing, FACEBOOK, marketing, , ");
  assert.deepEqual(terms, ["facebook", "marketing"]);
  assert.deepEqual(normalizeSearchTerms("facebook, marketing"), terms);
  assert.deepEqual(normalizeSearchTerms("marketing, facebook"), terms);
  assert.deepEqual(normalizeSearchTerms("R/Facebook, marketing"), terms);
  assert.deepEqual(
    normalizeSearchTerms("facebook ads, marketing for facebook"),
    ["facebook ads", "marketing for facebook"],
  );
  assert.deepEqual(normalizeSearchTerms(" , , "), []);
});

test("queries reuse individual term embeddings across combinations and orders", async () => {
  const f = fixture();
  const load = createQueryEmbeddingLoader({
    cache: () => f.cache,
    embed: f.embed,
  });
  for (const query of [
    "marketing",
    "facebook, marketing",
    "Marketing, FACEBOOK",
  ]) {
    await Promise.all(
      normalizeSearchTerms(query).map((term) => load(term, "key")),
    );
  }
  assert.deepEqual(f.calls, ["marketing", "facebook"]);
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[0].ttl, 30 * 24 * 60 * 60);
  assert.match(f.writes[0].key, /^[a-f0-9]{64}$/);
  assert.notEqual(
    queryEmbeddingCacheKey("marketing"),
    queryEmbeddingCacheKey("facebook"),
  );
});

test("concurrent identical misses share one embedding call", async () => {
  const f = fixture();
  const load = createQueryEmbeddingLoader({
    cache: () => f.cache,
    embed: f.embed,
  });
  await Promise.all(Array.from({ length: 10 }, () => load("marketing", "key")));
  assert.deepEqual(f.calls, ["marketing"]);
  assert.equal(f.writes.length, 1);
});

test("cache read, write, and initialization failures do not break search", async () => {
  for (const operation of ["get", "set", "initialization"] as const) {
    const f = fixture();
    if (operation !== "initialization") {
      f.cache[operation] = async () => {
        throw new Error("cache unavailable");
      };
    }
    const load = createQueryEmbeddingLoader({
      cache: () => {
        if (operation === "initialization")
          throw new Error("cache unavailable");
        return f.cache;
      },
      embed: f.embed,
    });
    assert.deepEqual(await load("marketing", "key"), vector);
    assert.deepEqual(f.calls, ["marketing"]);
  }
});

test("invalid cached vectors are regenerated", async () => {
  for (const invalid of [
    [1],
    Array(4096).fill(0),
    [Number.NaN, ...vector.slice(1)],
    [Number.POSITIVE_INFINITY, ...vector.slice(1)],
    ["1", ...vector.slice(1)],
  ]) {
    const f = fixture();
    f.entries.set(queryEmbeddingCacheKey("marketing"), invalid);
    const load = createQueryEmbeddingLoader({
      cache: () => f.cache,
      embed: f.embed,
    });
    assert.deepEqual(await load("marketing", "key"), vector);
    assert.equal(f.calls.length, 1);
    assert.equal(f.writes.length, 1);
  }
});

test("failed embedding requests are not cached or retained as pending work", async () => {
  const f = fixture();
  let attempts = 0;
  const load = createQueryEmbeddingLoader({
    cache: () => f.cache,
    embed: async () => {
      if (++attempts === 1) throw new Error("provider unavailable");
      return vector;
    },
  });
  await assert.rejects(load("marketing", "key"), /provider unavailable/);
  assert.equal(f.writes.length, 0);
  assert.deepEqual(await load("marketing", "key"), vector);
  assert.equal(attempts, 2);
});

test("invalid provider vectors are never cached", async () => {
  const f = fixture();
  const load = createQueryEmbeddingLoader({
    cache: () => f.cache,
    embed: async () => [1],
  });
  await assert.rejects(load("marketing", "key"), /Invalid query embedding/);
  assert.equal(f.writes.length, 0);
});
