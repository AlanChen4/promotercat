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
