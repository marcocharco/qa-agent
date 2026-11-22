import { z } from "zod";
import { askAboutImage } from "./vision";

export type Mark = { file: string; box: [number, number, number, number] | null; label: string };
/** v: 3 holds a mark for every frame that shows the wrong value. Older stored shapes are asked again. */
export type Highlight = { v: 3; marks: Mark[] };

const Answer = z.object({
  visible: z.boolean().describe("true only if the wrong or missing value can be seen in this screenshot"),
  box_2d: z.array(z.number()).length(4).describe("[ymin, xmin, ymax, xmax] on a 0-1000 scale around the wrong value, or zeros when not visible"),
  label: z.string().describe("At most 12 words: what is wrong there, for example 'Total is $798.00, expected $820.80'"),
});

/** Asks a vision model whether one screenshot shows the failure, and where. Never throws: no box is a valid answer. */
export async function locateError(file: string, requirement: string, reason: string): Promise<Mark> {
  try {
    const a = await askAboutImage(file, `A browser test failed. Requirement: ${requirement}\nWhat the tester reported: ${reason}\n\nThis is one screenshot from the test. If it shows a value that is wrong for the requirement (it may differ from the value the tester reported, for example a different wrong total), draw a tight box around that value and write a label naming the value on screen and the expected value. A value cut off by the edge of the screenshot still counts if you can read it. If this screenshot shows the correct value, or does not show the value at all, set visible to false.`, Answer);
    return { file, box: a.visible && a.box_2d.some((n) => n > 0) ? (a.box_2d as Mark["box"]) : null, label: a.label };
  } catch {
    return { file, box: null, label: "" };
  }
}

/**
 * Every frame that shows the wrong value gets a mark, not only the last (the page keeps showing the bug for several steps).
 * The frames are checked in parallel. If none shows it, the last frame's label is kept as a caption with no box.
 */
export async function locateAll(files: string[], requirement: string, reason: string): Promise<Highlight> {
  const marks = await Promise.all(files.map((f) => locateError(f, requirement, reason)));
  const seen = marks.filter((m) => m.box);
  return { v: 3, marks: seen.length ? seen : marks.slice(-1).filter((m) => m.label) };
}
