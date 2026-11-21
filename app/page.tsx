import { redirect } from "next/navigation";
import { listTrails } from "@/lib/queries";

export default async function Home() {
  const trails = await listTrails();
  if (trails[0]) redirect(`/t/${trails[0].id}`);
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">No Trails yet</h1>
      <p className="mt-3 max-w-lg text-muted">
        Run the orchestrator on a Trail (<code className="font-mono text-sm">npx tsx --env-file=.env.local scripts/orchestrate.mts &lt;trail-number&gt;</code>)
        or load sample data with <code className="font-mono text-sm">scripts/seed-ui.mts</code>.
      </p>
    </main>
  );
}
