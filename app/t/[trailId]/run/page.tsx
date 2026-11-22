import LiveGrid from "@/components/LiveGrid";
import { getLive } from "@/lib/queries";

export default async function RunPage({ params }: { params: Promise<{ trailId: string }> }) {
  const { trailId } = await params;
  return <LiveGrid trailId={trailId} initial={await getLive(trailId)} />;
}
