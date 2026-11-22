import Link from "next/link";
import { notFound } from "next/navigation";
import CopyReport from "@/components/CopyReport";
import StatusIcon from "@/components/StatusIcon";
import { ago, chip } from "@/components/ui";
import { buildReport, prMarkdown } from "@/lib/prReport";
import type { Verdict } from "@/lib/overview";

const banner: Record<Verdict, { text: string; cls: string; icon: "passed" | "failed" | "review" | "running" | "todo" | "errored" }> = {
  merge: { text: "All requirements pass on the live site", cls: "bg-pass/10 text-pass", icon: "passed" },
  hold: { text: "Failing requirements block this merge", cls: "bg-fail/10 text-fail", icon: "failed" },
  review: { text: "Needs a look before merging", cls: "bg-accent/10 text-accent", icon: "review" },
  running: { text: "Run in progress", cls: "bg-accent/10 text-accent", icon: "running" },
  idle: { text: "Not run yet", cls: "bg-chip text-muted", icon: "todo" },
  broken: { text: "The last run could not test anything", cls: "bg-chip text-muted", icon: "errored" },
};

const heading = "text-sm font-medium uppercase tracking-wide text-muted";

/** One shareable page that replaces the PR description: why it was built, what changed, and proof it works. */
export default async function Report({ params }: { params: Promise<{ trailId: string }> }) {
  const { trailId } = await params;
  const d = await buildReport(trailId);
  if (!d) notFound();
  const b = banner[d.verdict];
  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs text-muted"><span className={chip}>{d.branch || "no branch"}</span>{d.commit && <span className={chip}>{d.commit.slice(0, 7)}</span>}{d.ranAt && <span>tested {ago(d.ranAt)}</span>}</span>
        <div className="flex items-center gap-3">
          <Link href={`/t/${trailId}`} className="text-sm text-muted hover:text-foreground">Open in ArcherFish</Link>
          <CopyReport markdown={prMarkdown(d, "https://REPORT_ORIGIN")} />
        </div>
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{d.title}</h1>
      <p className={`mt-5 inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-sm font-semibold ${b.cls}`}><StatusIcon state={b.icon} size={18} />{b.text}<span className="font-normal opacity-80">· {d.passed} of {d.ran} tested pass</span></p>

      <section className="mt-12">
        <h2 className={heading}>Why this was built</h2>
        {d.description && <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">{d.description}</p>}
        <ul className="mt-4 space-y-4">
          {d.asks.map((a) => (
            <li key={a.text}>
              <p className="leading-snug">{a.text}</p>
              {a.quote && <p className="mt-1 border-l-2 border-line pl-3 text-sm italic text-muted">&ldquo;{a.quote}&rdquo; <span className="not-italic">from the developer&apos;s chat</span></p>}
            </li>
          ))}
          {!d.asks.length && <li className="text-sm text-muted">No requirements extracted yet.</li>}
        </ul>
      </section>

      {d.changes.length > 0 && (
        <section className="mt-12">
          <h2 className={heading}>What changed</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {d.changes.map((f) => (
              <li key={f.path} className="py-3">
                <p className="flex items-center gap-2 font-mono text-sm"><span className={chip}>{f.status}</span>{f.path}</p>
                {f.items.length > 0 && <ul className="mt-1.5 space-y-0.5 pl-1 text-sm text-muted">{f.items.slice(0, 8).map((i) => <li key={i}>{i}</li>)}</ul>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className={heading}>Proof it works</h2>
        <p className="mt-1 text-sm text-muted">Each requirement was tried by a real browser on the live site. What it saw is quoted, and the last frame is attached.</p>
        <ul className="mt-4 space-y-5">
          {d.proof.map((p) => (
            <li key={p.checkId} className={`overflow-hidden rounded-2xl border ${p.state === "failed" ? "border-fail/40" : "border-line"}`}>
              <div className="flex items-start gap-3 px-5 py-4">
                <span className="mt-0.5"><StatusIcon state={p.state} size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{p.label}</p>
                  {p.state !== "passed" && p.claim && <p className="mt-1 text-sm leading-relaxed text-muted">{p.claim}</p>}
                  {p.saw && <p className="mt-2 rounded-lg bg-panel px-3 py-2 font-mono text-xs leading-relaxed text-muted">Saw: {p.saw}</p>}
                  {p.state === "failed" && p.checkId && <Link href={`/t/${trailId}/checks/${p.checkId}`} className="mt-2 inline-block text-sm font-medium text-accent hover:underline">Replay what went wrong →</Link>}
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.frame && <img src={`/api/replay/${p.frame}`} alt={`What the browser saw: ${p.label}`} className="w-full border-t border-line bg-panel" loading="lazy" />}
            </li>
          ))}
          {!d.proof.length && <li className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">Nothing has been tested yet.</li>}
        </ul>
      </section>

      {(d.decisions.length > 0 || d.untestable.length > 0) && (
        <section className="mt-12">
          <h2 className={heading}>Decisions and gaps</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {d.decisions.map((x) => (
              <li key={x.now} className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3"><p className="font-medium text-accent">A requirement changed in the chat</p><p className="mt-1 text-muted line-through">{x.was}</p><p className="mt-1">{x.now}</p></li>
            ))}
            {d.untestable.map((u) => <li key={u.text} className="text-muted">Cannot be tested: {u.text} ({u.reason})</li>)}
          </ul>
        </section>
      )}
    </main>
  );
}
