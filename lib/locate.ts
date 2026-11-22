import { readFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export type Highlight = { file: string; box: [number, number, number, number] | null; label: string };

const Answer = z.object({
  visible: z.boolean().describe("true only if the wrong or missing value can be seen in this screenshot"),
  box_2d: z.array(z.number()).length(4).describe("[ymin, xmin, ymax, xmax] on a 0-1000 scale around the wrong value, or zeros when not visible"),
  label: z.string().describe("At most 12 words: what is wrong there, for example 'Total is $798.00, expected $820.80'"),
});

/** Asks a vision model where on the screenshot the failure shows. Never throws: no box is a valid answer. */
export async function locateError(file: string, requirement: string, reason: string): Promise<Highlight> {
  try {
    const img = await readFile(path.join(process.cwd(), "data", "replays", file));
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
      contents: [{ role: "user", parts: [
        { inlineData: { mimeType: file.endsWith(".png") ? "image/png" : "image/jpeg", data: img.toString("base64") } },
        { text: `A browser test failed. Requirement: ${requirement}\nWhat the tester reported: ${reason}\n\nThis is the last screenshot. Draw a tight box around the on-screen value, line or element that is wrong or missing. If the screenshot does not show it (for example it is below the fold), set visible to false.` },
      ] }],
      config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(Answer), temperature: 0 },
    });
    const a = Answer.parse(JSON.parse(res.text ?? "null"));
    return { file, box: a.visible && a.box_2d.some((n) => n > 0) ? (a.box_2d as Highlight["box"]) : null, label: a.label };
  } catch {
    return { file, box: null, label: "" };
  }
}
