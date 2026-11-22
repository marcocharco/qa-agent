import AddRequirement from "@/components/AddRequirement";
import CoverageCard from "@/components/CoverageCard";
import RequirementRow from "@/components/RequirementRow";
import RunNow from "@/components/RunNow";
import { chip } from "@/components/ui";
import { listRequirements, trailCoverage, type RequirementRow as Req } from "@/lib/queries";

function Section({ title, hint, rows, showTrail, empty, collapsed }: { title: string; hint: string; rows: Req[]; showTrail?: boolean; empty: string; collapsed?: boolean }) {
  const body = (
    <>
      {!collapsed && (
        <>
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <span className={chip}>{rows.length}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{hint}</p>
        </>
      )}
      {rows.length ? (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {rows.map((r) => <RequirementRow key={r.id} r={r} showTrail={showTrail} />)}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted">{empty}</p>
      )}
    </>
  );
  return collapsed ? (
    <details className="mt-10">
      <summary className="cursor-pointer list-none">
        <span className="text-xl font-semibold tracking-tight">{title}</span> <span className={chip}>{rows.length}</span>
        <span className="ml-3 text-sm text-muted">{hint} Click to show.</span>
      </summary>
      <section className="mt-4">{body}</section>
    </details>
  ) : (
    <section className="mt-10">{body}</section>
  );
}

export default async function Requirements({ params }: { params: Promise<{ trailId: string }> }) {
  const { trailId } = await params;
  const [{ fresh, regression }, coverage] = await Promise.all([listRequirements(trailId), trailCoverage(trailId)]);
  const runnable = fresh.filter((r) => r.testable && (r.status === "proposed" || r.status === "approved")).length + regression.length;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">{runnable} requirements will run: this Trail&apos;s proposed and approved asks, plus the approved ones from merged Trails.</p>
        <RunNow trailId={trailId} />
      </div>
      <CoverageCard c={coverage} />
      <div className="mt-6"><AddRequirement trailId={trailId} /></div>
      <Section title="New" hint="Extracted from this Trail's description and sessions." rows={fresh} empty="Nothing extracted yet. Press Run now to read the Trail and its sessions, or add a requirement yourself above." />
      <Section title="Regression" hint="Approved requirements from merged Trails. They run on every push." rows={regression} showTrail collapsed empty="No approved requirements from merged Trails yet. Approve requirements on a Trail and merge it to build the regression suite." />
    </>
  );
}
