import { notFound } from "next/navigation";
import { TrailTabs } from "@/components/TrailNav";
import { chip } from "@/components/ui";
import { getTrail } from "@/lib/queries";

export default async function TrailLayout({ children, params }: { children: React.ReactNode; params: Promise<{ trailId: string }> }) {
  const { trailId } = await params;
  const trail = await getTrail(trailId);
  if (!trail) notFound();
  return (
    <main className="mx-auto w-full max-w-[1680px] px-5 pb-10 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-xl font-semibold tracking-tight">{trail.title}</h1>
        <span className={chip}>{trail.state}{trail.branch ? ` · ${trail.branch}` : ""}</span>
      </div>
      <div className="relative mt-2">
        <TrailTabs trailId={trailId} />
        <details className="absolute right-0 top-0 z-20 text-sm text-muted">
          <summary className="py-0.5">What this Trail is for</summary>
          <p className="mt-2 w-[min(32rem,90vw)] whitespace-pre-line rounded-xl border border-line bg-background p-4 shadow-lg">{trail.description}</p>
        </details>
      </div>
      <div className="pt-3">{children}</div>
    </main>
  );
}
