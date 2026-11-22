import Link from "next/link";
import { ago, seconds } from "@/components/ui";
import PassRateChart from "@/components/PassRateChart";
import { listHistory } from "@/lib/queries";

export default async function History({ params }: { params: Promise<{ trailId: string }> }) {
  const { trailId } = await params;
  const runs = await listHistory(trailId);
  if (!runs.length) return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted">No runs for this Trail yet.</p>;
  return (
    <>
    <PassRateChart runs={runs} />
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line text-muted">
          <tr>{["Started", "Commit", "Pass rate", "Passed", "Failed", "Errored", "Duration", "Failures"].map((h) => <th key={h} className="whitespace-nowrap py-3 pr-4 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {runs.map((r) => {
            const open = r.durationMs == null;
            const total = r.passed + r.failed + r.errored;
            return (
              <tr key={r.id} className="align-top">
                <td className="py-3 pr-4 whitespace-nowrap">{ago(r.startedAt)}</td>
                <td className="py-3 pr-4 font-mono">{r.headSha.slice(0, 7)}</td>
                <td className="py-3 pr-4">{open ? "running" : total ? `${Math.round((r.passed / total) * 100)}%` : "n/a"}</td>
                <td className="py-3 pr-4">{open ? "-" : r.passed}</td>
                <td className="py-3 pr-4">{open ? "-" : r.failed}</td>
                <td className="py-3 pr-4">{open ? "-" : r.errored}</td>
                <td className="py-3 pr-4 whitespace-nowrap">{seconds(r.durationMs) || "n/a"}</td>
                <td className="py-3">
                  {r.failures.length ? (
                    <ul className="space-y-1">
                      {r.failures.map((f) => (
                        <li key={f.checkId}><Link className="hover:text-accent hover:underline" href={`/t/${trailId}/checks/${f.checkId}`}>{f.requirement}</Link></li>
                      ))}
                    </ul>
                  ) : <span className="text-muted">none</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
