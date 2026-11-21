import { notFound } from "next/navigation";
import { Tabs, TrailPicker } from "@/components/TrailNav";
import { chip } from "@/components/ui";
import { getTrail, listTrails } from "@/lib/queries";

export default async function TrailLayout({ children, params }: { children: React.ReactNode; params: Promise<{ trailId: string }> }) {
  const { trailId } = await params;
  const [trail, trails] = await Promise.all([getTrail(trailId), listTrails()]);
  if (!trail) notFound();
  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TrailPicker trails={trails} current={trailId} />
        <span className={chip}>{trail.state}{trail.branch ? ` · ${trail.branch}` : ""}</span>
      </div>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight md:text-4xl">{trail.title}</h1>
      <p className="mt-3 max-w-3xl text-muted">{trail.description}</p>
      <div className="mt-8">
        <Tabs trailId={trailId} />
      </div>
      <div className="pt-8">{children}</div>
    </main>
  );
}
