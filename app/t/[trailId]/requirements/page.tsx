import AddRequirement from "@/components/AddRequirement";
import CoverageCard from "@/components/CoverageCard";
import RequirementsBoard from "@/components/RequirementsBoard";
import RunNow from "@/components/RunNow";
import { listRequirements, trailCoverage } from "@/lib/queries";

export default async function Requirements({ params }: { params: Promise<{ trailId: string }> }) {
  const { trailId } = await params;
  const [{ fresh, regression }, coverage] = await Promise.all([listRequirements(trailId), trailCoverage(trailId)]);
  const runnable = fresh.filter((r) => r.testable && (r.status === "proposed" || r.status === "approved")).length + regression.length;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">{runnable} requirements will run. Unreviewed ones run too, but their failures only block the merge once you approve them.</p>
        <RunNow trailId={trailId} />
      </div>
      <CoverageCard c={coverage} />
      <div className="mt-6"><AddRequirement trailId={trailId} /></div>
      <RequirementsBoard fresh={fresh} regression={regression} />
    </>
  );
}
