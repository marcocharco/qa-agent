import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { StructuredModel } from "./compile";

/** Real Gemini behind the StructuredModel seam. Model id is one config value. */
export function geminiModel(model = process.env.GEMINI_MODEL ?? "gemini-3.8-flash"): StructuredModel {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return async (prompt, schema) => {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(schema),
        temperature: 0,
      },
    });
    return JSON.parse(res.text ?? "null");
  };
}
