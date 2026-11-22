import { db } from "./db";
import { openFindings, setSeverity } from "./entire";
import { trailNumber } from "./process";

/**
 * Approval is what makes a failure block the merge. After a human approves (or un-approves) a requirement,
 * move its open finding between high and low so the Entire gate follows. Best effort: no open finding means nothing to do.
 */
export async function syncFindingSeverity(requirementId: string, approved: boolean): Promise<void> {
  const row = (await db().query("select trail_id from requirements where id = $1", [requirementId])).rows[0];
  if (!row || String(row.trail_id).startsWith("sample-")) return; // sample data has no Entire Trail
  const ref = { project: process.env.ENTIRE_PROJECT!, trail: await trailNumber(row.trail_id) };
  const findingId = (await openFindings(ref))[requirementId];
  if (findingId) await setSeverity(findingId, approved ? "high" : "low", ref);
}
