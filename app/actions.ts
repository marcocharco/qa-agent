"use server";

import { revalidatePath } from "next/cache";
import { forgetRequirement, rememberRequirement } from "@/lib/brain";
import { syncFindingSeverity } from "@/lib/gate";
import { addManualRequirement, editRequirement, requirementStatus, setRequirementStatus, supersededBy, type RequirementRow, type Status } from "@/lib/queries";

const refresh = () => revalidatePath("/t/[trailId]", "layout");

/** Brain trouble never blocks a review decision, it comes back as a warning. */
async function sync(id: string, approved: boolean): Promise<string | null> {
  try {
    await (approved ? rememberRequirement(id) : forgetRequirement(id));
    return null;
  } catch (e) {
    return `Saved, but Brain was not updated: ${String(e).slice(0, 120)}`;
  }
}

export async function setStatus(id: string, status: Status): Promise<string | null> {
  await setRequirementStatus(id, status);
  let warning = await sync(id, status === "approved");
  // The merge gate follows approval: an approved requirement's failure blocks, an unreviewed one's does not.
  if (status === "approved" || status === "rejected" || status === "proposed") {
    try { await syncFindingSeverity(id, status === "approved"); } catch (e) { warning = warning ?? `Saved, but the merge gate was not updated: ${String(e).slice(0, 100)}`; }
  }
  // Drift is only applied here, by a human: approving a change retires the requirement it replaces.
  const old = status === "approved" ? await supersededBy(id) : null;
  if (old) {
    await setRequirementStatus(old, "superseded");
    warning = (await sync(old, false)) ?? warning;
  }
  refresh();
  return warning;
}

/** Approve or reject several at once. Each goes through setStatus so Brain and drift stay consistent. */
export async function setMany(ids: string[], status: Status): Promise<string | null> {
  let warning: string | null = null;
  for (const id of ids) warning = (await setStatus(id, status)) ?? warning;
  return warning;
}

export async function editText(id: string, text: string): Promise<string | null> {
  if (!text.trim()) return null;
  const wasApproved = (await requirementStatus(id)) === "approved";
  if (wasApproved) await sync(id, false); // retract the old wording
  await editRequirement(id, text.trim());
  const warning = wasApproved ? await sync(id, true) : null;
  refresh();
  return warning;
}

export async function addRequirement(trailId: string, text: string, type: RequirementRow["type"]): Promise<string | null> {
  if (!text.trim()) return "Write the requirement first";
  let id: string;
  try {
    id = await addManualRequirement(trailId, text.trim(), type);
  } catch (e) {
    return String(e).includes("requirements_trail_text") ? "This Trail already has that requirement" : "Could not add the requirement";
  }
  const warning = await sync(id, true);
  refresh();
  return warning;
}
