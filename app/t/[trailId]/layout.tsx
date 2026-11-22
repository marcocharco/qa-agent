import { notFound } from "next/navigation";
import { TrailStatusBar, TrailLiveProvider } from "@/components/TrailLive";
import { TrailTabs } from "@/components/TrailNav";
import { chip } from "@/components/ui";
import { getLive, getTrail, listRequirements } from "@/lib/queries";

export default async function TrailLayout({ children, params }: { children: React.ReactNode; params: Promise<{ trailId: string }> }) {
  const { trailId } = await params;
  const [trail, { fresh, regression }, live] = await Promise.all([getTrail(trailId), listRequirements(trailId), getLive(trailId)]);
  if (!trail) notFound();
  return (
    <main className="mx-auto w-full max-w-[1680px] px-5 pb-10 pt-5">
      <TrailLiveProvider trailId={trailId} fresh={fresh} regression={regression} initial={live}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="text-xl font-semibold tracking-tight">{trail.title}</h1>
          <span className={chip}>{trail.state}{trail.branch ? ` · ${trail.branch}` : ""}</span>
        </div>
        <details className="relative mt-0.5 w-fit text-sm text-muted">
          <summary className="py-0.5">What this Trail is for</summary>
          <p className="absolute left-0 top-full z-20 mt-1 w-[min(32rem,90vw)] whitespace-pre-line rounded-xl border border-line bg-background p-4 shadow-lg">{trail.description}</p>
        </details>
        <div className="mt-2"><TrailStatusBar trailId={trailId} /></div>
        <div className="mt-3">
          <TrailTabs trailId={trailId} />
        </div>
        <div className="pt-3">{children}</div>
      </TrailLiveProvider>
    </main>
  );
}
