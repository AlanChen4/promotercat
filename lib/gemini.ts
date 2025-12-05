import { GoogleGenAI } from "@google/genai";

export const createGeminiClient = (() => {
  let client: GoogleGenAI | null = null;
  return () => {
    if (client) {
      return client;
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        baseUrl: "https://gateway.helicone.ai",
        headers: {
          "Helicone-Auth": `Bearer ${process.env.LLM_GATEWAY_API_KEY}`,
          "Helicone-Target-URL": "https://generativelanguage.googleapis.com",
          "Helicone-Property-Environment":
            process.env.NODE_ENV === "production" ? "prd" : "dev",
        },
      },
    });
    return client;
  };
})();
