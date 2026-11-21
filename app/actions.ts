"use server";

import { revalidatePath } from "next/cache";
import { addManualRequirement, editRequirement, setRequirementStatus, type RequirementRow, type Status } from "@/lib/queries";

const refresh = () => revalidatePath("/t/[trailId]", "layout");

export async function setStatus(id: string, status: Status) {
  await setRequirementStatus(id, status);
  refresh();
}

export async function editText(id: string, text: string) {
  if (!text.trim()) return;
  await editRequirement(id, text.trim());
  refresh();
}

export async function addRequirement(trailId: string, text: string, type: RequirementRow["type"]): Promise<string | null> {
  if (!text.trim()) return "Write the requirement first";
  try {
    await addManualRequirement(trailId, text.trim(), type);
  } catch (e) {
    return String(e).includes("requirements_trail_text") ? "This Trail already has that requirement" : "Could not add the requirement";
  }
  refresh();
  return null;
}
