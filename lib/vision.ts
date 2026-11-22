import { readFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

/** One structured question about one replay screenshot (path relative to data/replays). Throws on failure. */
export async function askAboutImage<T extends z.ZodType>(file: string, question: string, schema: T): Promise<z.infer<T>> {
  const img = await readFile(path.join(process.cwd(), "data", "replays", file));
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
    contents: [{ role: "user", parts: [
      { inlineData: { mimeType: file.endsWith(".png") ? "image/png" : "image/jpeg", data: img.toString("base64") } },
      { text: question },
    ] }],
    config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema), temperature: 0 },
  });
  return schema.parse(JSON.parse(res.text ?? "null"));
}
