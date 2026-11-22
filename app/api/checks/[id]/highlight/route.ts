import { collapseSteps } from "@/lib/collapse";
import { db } from "@/lib/db";
import { locateError, type Highlight } from "@/lib/locate";
import { getCheck } from "@/lib/queries";

/** Where the failure shows on the evidence screenshot. Found once, then stored on the check. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCheck(id);
  if (!c?.replay || c.status !== "failed") return Response.json({ highlight: null });
  // The same evidence frame the replay ends on.
  const file = collapseSteps(c.replay.steps.slice(c.replay.start, c.replay.end + 1), c.replay.cursors).at(-1)?.file;
  if (!file) return Response.json({ highlight: null });
  const cached = (await db().query("select highlight from checks where id=$1", [id])).rows[0]?.highlight as Highlight | null;
  if (cached?.file === file) return Response.json({ highlight: cached });
  const highlight = await locateError(file, c.requirement, c.reason ?? "");
  await db().query("update checks set highlight=$2 where id=$1", [id, JSON.stringify(highlight)]);
  return Response.json({ highlight });
}
