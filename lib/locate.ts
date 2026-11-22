import { z } from "zod";
import { askAboutImage } from "./vision";

export type Highlight = { file: string; box: [number, number, number, number] | null; label: string };

const Answer = z.object({
  visible: z.boolean().describe("true only if the wrong or missing value can be seen in this screenshot"),
  box_2d: z.array(z.number()).length(4).describe("[ymin, xmin, ymax, xmax] on a 0-1000 scale around the wrong value, or zeros when not visible"),
  label: z.string().describe("At most 12 words: what is wrong there, for example 'Total is $798.00, expected $820.80'"),
});

/** Asks a vision model where on the screenshot the failure shows. Never throws: no box is a valid answer. */
export async function locateError(file: string, requirement: string, reason: string): Promise<Highlight> {
  try {
    const a = await askAboutImage(file, `A browser test failed. Requirement: ${requirement}\nWhat the tester reported: ${reason}\n\nThis is the last screenshot. Draw a tight box around the on-screen value, line or element that is wrong or missing. If the screenshot does not show it (for example it is below the fold), set visible to false.`, Answer);
    return { file, box: a.visible && a.box_2d.some((n) => n > 0) ? (a.box_2d as Highlight["box"]) : null, label: a.label };
  } catch {
    return { file, box: null, label: "" };
  }
}
