import Link from "next/link";
import { ago, seconds } from "@/components/ui";
import { listHistory, type HistoryRow } from "@/lib/queries";

const rate = (r: HistoryRow) => { const t = r.passed + r.failed + r.errored; return t ? r.passed / t : 0; };

/** One bar per finished run, oldest to newest, bar height is the pass rate. */
function PassRateChart({ runs }: { runs: HistoryRow[] }) {
  const done = runs.filter((r) => r.durationMs != null).reverse();
  if (done.length < 2) return null;
  return (
    <div className="mb-8 rounded-2xl border border-line p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Pass rate per run</h2>
      <div className="mt-4 flex h-28 items-end gap-2" role="img" aria-label="Pass rate per run, oldest to newest">
        {done.map((r) => (
          <div key={r.id} className="flex h-full max-w-12 flex-1 flex-col justify-end" title={`${r.headSha.slice(0, 7)}: ${Math.round(rate(r) * 100)}% passed`}>
            <div className={`rounded-t ${r.failed + r.errored ? "bg-accent" : "bg-pass"}`} style={{ height: `${Math.max(rate(r) * 100, 3)}%` }} />
            <span className="mt-1 text-center font-mono text-[10px] text-muted">{r.headSha.slice(0, 4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function History({ params }: { params: Promise<{ trailId: string }> }) {
  const { trailId } = await params;
  const runs = await listHistory(trailId);
  if (!runs.length) return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted">No runs for this Trail yet.</p>;
  return (
    <>
    <Link href={`/t/${trailId}`} className="mb-6 inline-block text-sm text-muted hover:text-foreground">← Back to the run</Link>
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
