import { forgetRequirement } from "@/lib/brain";
import { resolveFinding } from "@/lib/entire";
import { overrideFinding, type OverrideKind } from "@/lib/findings";
import { trailNumber } from "@/lib/process";
import { getCheck, setRequirementStatus } from "@/lib/queries";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { kind } = (await req.json()) as { kind: OverrideKind };
  if (kind !== "not-a-bug" && kind !== "requirement-wrong") return Response.json({ error: "Unknown override" }, { status: 400 });
  const check = await getCheck((await params).id);
  if (!check?.findingId) return Response.json({ error: "This check has no Entire finding to resolve" }, { status: 400 });
  try {
    const out = overrideFinding(kind, { requirementId: check.requirementId, findingId: check.findingId });
    const ref = { project: process.env.ENTIRE_PROJECT!, trail: await trailNumber(check.trailId) };
    await resolveFinding(out.resolve.findingId, out.resolve.message, ref);
    if (out.requirementStatus) await setRequirementStatus(check.requirementId, out.requirementStatus);
    if (out.removeFromBrain) await forgetRequirement(check.requirementId).catch(() => {});
    return Response.json({ ok: true, message: out.resolve.message });
  } catch (e) {
    return Response.json({ error: `Could not resolve the finding: ${String(e).slice(0, 200)}` }, { status: 502 });
  }
}
