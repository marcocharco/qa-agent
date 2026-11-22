import Link from "next/link";
import { notFound } from "next/navigation";
import BugReport from "@/components/BugReport";
import { openFindings } from "@/lib/entire";
import { trailNumber } from "@/lib/process";
import { getCheck } from "@/lib/queries";

/** Whether the finding is still open on Entire. null when Entire cannot be reached. */
async function findingOpen(trailId: string, findingId: string | null) {
  if (!findingId) return null;
  try {
    const open = await openFindings({ project: process.env.ENTIRE_PROJECT!, trail: await trailNumber(trailId) });
    return Object.values(open).includes(findingId);
  } catch {
    return null;
  }
}

export default async function BugReportPage({ params }: { params: Promise<{ trailId: string; checkId: string }> }) {
  const { trailId, checkId } = await params;
  const check = await getCheck(checkId);
  if (!check || check.trailId !== trailId) notFound();
  return (
    <>
      <Link href={`/t/${trailId}`} className="text-sm text-muted hover:text-foreground">← Back to the run</Link>
      <div className="mt-4"><BugReport check={check} findingOpen={await findingOpen(trailId, check.findingId)} /></div>
    </>
  );
}
