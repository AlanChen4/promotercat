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
    client = new GoogleGenAI({ apiKey });
    return client;
  };
})();
