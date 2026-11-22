import { notFound } from "next/navigation";
import { TrailTabs } from "@/components/TrailNav";
import { chip } from "@/components/ui";
import { getTrail } from "@/lib/queries";

export default async function TrailLayout({ children, params }: { children: React.ReactNode; params: Promise<{ trailId: string }> }) {
  const { trailId } = await params;
  const trail = await getTrail(trailId);
  if (!trail) notFound();
  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{trail.title}</h1>
        <span className={chip}>{trail.state}{trail.branch ? ` · ${trail.branch}` : ""}</span>
      </div>
      <details className="mt-1 text-sm text-muted">
        <summary className="cursor-pointer">What this Trail is for</summary>
        <p className="mt-2 max-w-3xl whitespace-pre-line">{trail.description}</p>
      </details>
      <div className="mt-5">
        <TrailTabs trailId={trailId} />
      </div>
      <div className="pt-6">{children}</div>
    </main>
  );
}
