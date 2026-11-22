"use client";

import Link from "next/link";
import RunNow from "@/components/RunNow";
import { ago, seconds } from "@/components/ui";
import type { Data } from "../types";
import { LiveBrowser, ReqActions, ResultList, TopBar, buildCards, laneDot, nowLine, phaseOf, shortLabel, summarize, useLive, verdictOf, verdictTone } from "../shared";

export default function Phase({ data }: { data: Data }) {
  const live = useLive(data.trailId, data.live);
  const cards = buildCards(data, live);
  const phase = phaseOf(live);
  const v = verdictOf(cards);
  const s = summarize(cards);
  const drifts = data.fresh.filter((r) => r.supersedes && r.status === "proposed");
  const took = live.run?.finishedAt ? +new Date(live.run.finishedAt) - +new Date(live.run.startedAt) : null;
  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-8">
      <TopBar data={data} live={live} />
      {phase === "running" && (
        <>
          <p className="mt-8 text-2xl font-semibold tracking-tight">{nowLine(cards, live)}</p>
          <LiveBrowser live={live} className="mt-4 h-[calc(100vh-330px)] min-h-[380px]" />
          <ul className="mt-4 flex flex-wrap gap-2">
            {cards.filter((c) => c.check).map((c) => (
              <li key={c.req.id} className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs">
                <span className={`h-2 w-2 rounded-full ${laneDot[c.lane]}`} />{shortLabel(c.req.text, 36)}
              </li>
            ))}
          </ul>
        </>
      )}
      {phase === "done" && (
        <>
          <h2 className={`mt-8 text-3xl font-semibold tracking-tight ${verdictTone[v.verdict]}`}>{nowLine(cards, live)}</h2>
          <p className="mt-1 text-muted">{s.passed} of {s.total} pass · last run {live.run && ago(live.run.startedAt)}{took ? `, took ${seconds(took)}` : ""}</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <ResultList cards={cards} trailId={data.trailId} />
            <aside className="space-y-4">
              {drifts.map((r) => (
                <section key={r.id} className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm">
                  <p className="text-xs font-medium text-accent">A requirement changed</p>
                  <p className="mt-1 text-muted line-through">{shortLabel(r.supersedes!.text, 60)}</p>
                  <p className="mt-1">{shortLabel(r.text, 60)}</p>
                  <div className="mt-3"><ReqActions r={r} compact /></div>
                </section>
              ))}
              <section className="rounded-2xl border border-line bg-panel p-4">
                <p className="text-sm font-medium">Last run</p>
                <p className="mt-1 text-xs text-muted">The browser sessions are finished. Replay them step by step.</p>
                <Link className="mt-3 inline-block text-sm font-medium text-accent hover:underline" href={`/t/${data.trailId}/run`}>Open the run →</Link>
              </section>
              <p className="px-1 text-xs text-muted">{data.coverage.asks} asks from the chat · {data.coverage.untestable.length} cannot be tested · {data.coverage.neverRun.length} not run yet</p>
            </aside>
          </div>
        </>
      )}
      {phase === "idle" && (
        <div className="mt-16 flex flex-col items-center gap-5 text-center">
          <p className="text-2xl font-semibold tracking-tight">{nowLine(cards, live)}</p>
          <RunNow trailId={data.trailId} goToRun={false} label="Run the first test" />
        </div>
      )}
    </main>
  );
}
