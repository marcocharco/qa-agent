import RunView from "@/components/RunView";
import { getLive, listRequirements } from "@/lib/queries";

export default async function RunPage({ params }: { params: Promise<{ trailId: string }> }) {
  const { trailId } = await params;
  const [{ fresh, regression }, live] = await Promise.all([listRequirements(trailId), getLive(trailId)]);
  return <RunView trailId={trailId} fresh={fresh} regression={regression} initial={live} />;
}
