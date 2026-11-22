import { z } from "zod";
import type { Verdict } from "./verdict";
import { askAboutImage } from "./vision";

const Answer = z.object({
  seen: z.string().describe("The values in the screenshot that the claim is about, copied exactly. Empty if none are visible"),
  contradicts: z.boolean().describe("true only if a value clearly visible in the screenshot differs from what the tester claimed"),
});

/**
 * The agent says a check passed and quotes what it saw. Agents sometimes quote the expectation instead of the page, so
 * the last screenshot gets a second, independent look. Only a visible contradiction turns a pass into a failure: a screenshot
 * that does not show the values (they are below the fold) leaves the pass alone, and any error here does too.
 */
export async function verifyPass(
  v: Verdict, file: string | null, claim: string, ask: typeof askAboutImage = askAboutImage,
): Promise<Verdict> {
  if (v.state !== "passed" || !file) return v;
  try {
    const a = await ask(file, `A browser tester reported this about the page: ${claim}\n\nLook only at this screenshot. Copy into "seen" the price, total and discount values it shows that relate to that report. Set contradicts to true only if a value that is clearly visible here is different from what the tester reported. If the relevant values are not visible, set contradicts to false.`, Answer);
    if (!a.contradicts) return v;
    return { state: "failed", failedStep: null, reason: `The screenshot contradicts the agent's pass. The page shows: ${a.seen}. The agent claimed: ${claim}` };
  } catch {
    return v;
  }
}
