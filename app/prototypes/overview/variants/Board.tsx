"use client";

import Link from "next/link";
import type { Data } from "../types";
import { Badge, LANES, LiveBrowser, ReqActions, TopBar, buildCards, summarize, useLive, verdictOf, verdictTone, chip, type Card } from "../shared";

function CardView({ c, trailId }: { c: Card; trailId: string }) {
  const failed = c.check?.status === "failed";
  return (
    <li className={`rounded-xl border bg-background p-3 shadow-[0_1px_0_rgba(0,0,0,0.03)] ${failed ? "border-fail/40" : "border-line"}`}>
      <p className="line-clamp-3 text-[13px] leading-snug">{c.req.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {c.regression ? <span className={chip}>regression</span> : <span className={chip}>new</span>}
        {c.req.supersedes && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">changes earlier ask</span>}
        {c.check && c.lane !== "running" && <Badge status={c.check.status} />}
      </div>
      {c.lane === "attention" && c.check?.reason && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">{c.check.reason}</p>}
      {c.lane === "proposed" && <div className="mt-3"><ReqActions r={c.req} compact /></div>}
      {failed && <Link className="mt-2 inline-block text-xs font-medium text-accent hover:underline" href={`/t/${trailId}/checks/${c.check!.id}`}>Bug report →</Link>}
    </li>
  );
}

export default function Board({ data }: { data: Data }) {
  const live = useLive(data.trailId, data.live);
  const cards = buildCards(data, live);
  const s = summarize(cards);
  const v = verdictOf(cards);
  return (
    <main className="mx-auto w-full max-w-[1500px] px-6 pt-8">
      <TopBar data={data} live={live} />
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <LiveBrowser live={live} className="h-[320px]" />
        <section className="flex flex-col justify-between rounded-2xl border border-line bg-panel p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Merge recommendation</p>
            <p className={`mt-2 text-xl font-semibold leading-snug tracking-tight ${verdictTone[v.verdict]}`}>{v.text.split("\n")[0]}</p>
          </div>
          <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[["Passing", s.passed, "text-pass"], ["Failing", s.failed, "text-fail"], ["Flaky", s.review, "text-accent"], ["To review", s.proposed, "text-foreground"]].map(([k, n, tone]) => (
              <div key={String(k)} className="rounded-xl bg-background py-3"><dd className={`text-2xl font-semibold ${tone}`}>{n}</dd><dt className="text-xs text-muted">{k}</dt></div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted">{data.coverage.asks} asks from the chat · {data.coverage.untestable.length} cannot be tested · {data.coverage.neverRun.length} not run yet</p>
        </section>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-5">
        {LANES.map((l) => {
          const items = cards.filter((c) => c.lane === l.id);
          return (
            <section key={l.id} className="flex min-h-[200px] flex-col rounded-2xl bg-chip/60 p-2.5">
              <header className="flex items-baseline justify-between px-1.5 pb-2 pt-1">
                <h2 className={`text-sm font-semibold ${l.id === "attention" && items.length ? "text-fail" : ""}`}>{l.title}</h2>
                <span className="text-xs text-muted">{items.length}</span>
              </header>
              <ul className="flex flex-col gap-2">
                {items.map((c) => <CardView key={c.req.id} c={c} trailId={data.trailId} />)}
              </ul>
              {!items.length && <p className="px-2 py-6 text-center text-xs text-muted">{l.hint}</p>}
            </section>
          );
        })}
      </div>
    </main>
  );
}
