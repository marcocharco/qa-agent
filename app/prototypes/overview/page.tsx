import { notFound } from "next/navigation";
import { getLive, getTrail, listHistory, listRequirements, listTrails, trailCoverage } from "@/lib/queries";
import Harness from "./Harness";

// Prototype surface: nothing outside app/prototypes imports from here. Delete the folder after choosing.
export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string; v?: string }> }) {
  const sp = await searchParams;
  const trailId = sp.t ?? "sample-trail-demo";
  const trail = await getTrail(trailId);
  if (!trail) notFound();
  const [trails, { fresh, regression }, coverage, live, history] = await Promise.all([
    listTrails(), listRequirements(trailId), trailCoverage(trailId), getLive(trailId), listHistory(trailId),
  ]);
  const v = parseInt(sp.v ?? "1", 10);
  return <Harness initial={Number.isFinite(v) ? v - 1 : 0} data={{ trailId, trail, trails, fresh, regression, coverage, live, history }} />;
}
