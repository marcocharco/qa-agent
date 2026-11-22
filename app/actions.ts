"use server";

import { revalidatePath } from "next/cache";
import { forgetRequirement, rememberRequirement } from "@/lib/brain";
import { addManualRequirement, editRequirement, requirementStatus, setRequirementStatus, type RequirementRow, type Status } from "@/lib/queries";

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
  const warning = await sync(id, status === "approved");
  refresh();
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
