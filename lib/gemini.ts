import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { StructuredModel } from "./compile";

const TRANSIENT = /\b(503|504|429|UNAVAILABLE|DEADLINE_EXCEEDED|timed? ?out|ECONNRESET|fetch failed|AbortError|aborted)\b/i;
const QUOTA = /\b(429|RESOURCE_EXHAUSTED)\b/;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Real Gemini behind the StructuredModel seam. Under load it returns 503/504, so each model gets a few
 * backed-off attempts and then the next model in the list takes over. Model ids live in one place.
 */
export function geminiModel(
  models: string[] = [process.env.GEMINI_MODEL ?? "gemini-3.8-flash", "gemini-3.7-flash"],
): StructuredModel {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return async (prompt, schema) => {
    let last: unknown;
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          // Streamed so a slow answer keeps the connection busy: one long idle wait was being reset mid-response.
          const stream = await ai.models.generateContentStream({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseJsonSchema: z.toJSONSchema(schema),
              temperature: 0,
              httpOptions: { timeout: 240_000 },
            },
          });
          let text = "";
          for await (const chunk of stream) text += chunk.text ?? "";
          return JSON.parse(text || "null");
        } catch (e) {
          last = e;
          if (!TRANSIENT.test(String(e))) throw e;
          // A quota error will not clear in seconds: skip retries and try the next model.
          if (QUOTA.test(String(e))) break;
          await sleep(1500 * 2 ** attempt);
        }
      }
    }
    throw last;
  };
}
