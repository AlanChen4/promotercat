import { createHash } from "node:crypto";
import { getCache, type RuntimeCache } from "@vercel/functions";
import { createGateway, embed } from "ai";

export const EMBEDDING_MODEL = "alibaba/qwen3-embedding-8b";
export const EMBEDDING_DIMENSIONS = 4096;
export const QUERY_EMBEDDING_INSTRUCTION =
  "Given a search query, retrieve relevant subreddit names and descriptions.";

export async function embedDescription(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  apiKey: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const { embedding } = await embed({
    model: createGateway({ apiKey }).embeddingModel(EMBEDDING_MODEL),
    value:
      taskType === "RETRIEVAL_QUERY"
        ? `Instruct: ${QUERY_EMBEDDING_INSTRUCTION}\nQuery: ${text}`
        : text,
    abortSignal: AbortSignal.any([
      AbortSignal.timeout(60_000),
      ...(signal ? [signal] : []),
    ]),
  });
  if (
    embedding.length !== EMBEDDING_DIMENSIONS ||
    !embedding.every(Number.isFinite)
  ) {
    throw new Error("Gateway returned an invalid description embedding.");
  }
  // Inner-product search requires unit vectors to produce cosine similarity.
  const norm = Math.hypot(...embedding);
  if (norm === 0 || !Number.isFinite(norm)) {
    throw new Error("Gateway returned an invalid description embedding.");
  }
  return embedding.map((value) => value / norm);
}

const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
// Bump this when preprocessing or vector normalization changes.
const CACHE_VERSION = "v1";

export function queryEmbeddingCacheKey(term: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: CACHE_VERSION,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        instruction: QUERY_EMBEDDING_INSTRUCTION,
        term,
      }),
    )
    .digest("hex");
}

function isValidEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === EMBEDDING_DIMENSIONS &&
    value.every(
      (entry) => typeof entry === "number" && Number.isFinite(entry),
    ) &&
    Math.abs(Math.hypot(...value) - 1) < 0.001
  );
}

type Dependencies = {
  cache: () => Pick<RuntimeCache, "get" | "set">;
  embed: (term: string, apiKey: string) => Promise<number[]>;
};

export function createQueryEmbeddingLoader({ cache, embed }: Dependencies) {
  // Coalesce simultaneous misses within this function instance.
  const pending = new Map<string, Promise<number[]>>();

  async function load(term: string, apiKey: string, key: string) {
    let store: ReturnType<Dependencies["cache"]> | undefined;
    try {
      store = cache();
      const cached = await store.get(key);
      if (isValidEmbedding(cached)) return cached;
    } catch {
      console.warn("Query embedding cache read failed.");
    }

    const embedding = await embed(term, apiKey);
    if (!isValidEmbedding(embedding)) {
      throw new Error("Invalid query embedding.");
    }
    try {
      await store?.set(key, embedding, {
        ttl: CACHE_TTL_SECONDS,
        name: "query-embedding",
      });
    } catch {
      console.warn("Query embedding cache write failed.");
    }
    return embedding;
  }

  return async (term: string, apiKey: string): Promise<number[]> => {
    const key = queryEmbeddingCacheKey(term);
    const existing = pending.get(key);
    if (existing) return existing;
    const request = load(term, apiKey, key);
    pending.set(key, request);
    try {
      return await request;
    } finally {
      pending.delete(key);
    }
  };
}

export const getQueryEmbedding = createQueryEmbeddingLoader({
  cache: () =>
    getCache({
      namespace: "promotercat-query-embeddings",
      // Preserve our SHA-256 key instead of the SDK's default 32-bit hash.
      keyHashFunction: (key) => key,
    }),
  embed: (term, apiKey) => embedDescription(term, "RETRIEVAL_QUERY", apiKey),
});
