import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { StructuredModel } from "./compile";

const TRANSIENT = /\b(503|504|429|UNAVAILABLE|DEADLINE_EXCEEDED|timed? ?out)\b/i;
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
          const res = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseJsonSchema: z.toJSONSchema(schema),
              temperature: 0,
              httpOptions: { timeout: 60_000 },
            },
          });
          return JSON.parse(res.text ?? "null");
        } catch (e) {
          last = e;
          if (!TRANSIENT.test(String(e))) throw e;
          await sleep(1500 * 2 ** attempt);
        }
      }
    }
    throw last;
  };
}
