// Usage: npx tsx --env-file=.env.local scripts/reset-drift.mts
// Puts the proposed changes to earlier requirements (drift) back to pending, and the requirements they would replace back
// to approved, so the "reject on camera" beat can be filmed again.
import { closeDb, db } from "../lib/db";
import { forgetRequirement, rememberRequirement } from "../lib/brain";
import { setRequirementStatus } from "../lib/queries";

const drift = (await db().query("select id, supersedes_id, left(text,60) t from requirements where supersedes_id is not null")).rows;
for (const d of drift) {
  await setRequirementStatus(d.id, "proposed");
  await forgetRequirement(d.id).catch(() => {});
  await setRequirementStatus(d.supersedes_id, "approved");
  await rememberRequirement(d.supersedes_id).catch(() => {});
  console.log("pending again:", d.t);
}
await closeDb();
