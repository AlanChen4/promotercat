import { createGateway, embed } from "ai";

export function createAiGateway(apiKey = process.env.VERCEL_AI_GATEWAY) {
  if (!apiKey) throw new Error("VERCEL_AI_GATEWAY is not configured.");
  return createGateway({ apiKey });
}

export async function embedDescription(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  apiKey?: string,
) {
  const { embedding } = await embed({
    model: createAiGateway(apiKey).embeddingModel(
      "google/gemini-embedding-001",
    ),
    value: text,
    providerOptions: { google: { taskType, outputDimensionality: 3072 } },
    abortSignal: AbortSignal.timeout(60_000),
  });
  if (embedding.length !== 3072 || !embedding.every(Number.isFinite)) {
    throw new Error("Gateway returned an invalid description embedding.");
  }
  return embedding;
}
