import RunView from "@/components/RunView";

export default async function RunPage({ params }: { params: Promise<{ trailId: string }> }) {
  const { trailId } = await params;
  return <RunView trailId={trailId} />;
}
