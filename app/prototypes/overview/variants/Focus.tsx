"use client";

import Link from "next/link";
import { useState } from "react";
import type { Data } from "../types";
import { Badge, LiveBrowser, ReqActions, TopBar, buildCards, groupByFeature, laneDot, nowLine, shortLabel, splitReason, summarize, useLive } from "../shared";

export default function Focus({ data }: { data: Data }) {
  const live = useLive(data.trailId, data.live);
  const cards = buildCards(data, live);
  const s = summarize(cards);
  const first = cards.find((c) => c.lane === "attention") ?? cards.find((c) => c.lane === "running") ?? cards[0];
  const [picked, setPicked] = useState<string | null>(null);
  const sel = cards.find((c) => c.req.id === picked) ?? first;
  const { claim, saw } = splitReason(sel?.check?.reason ?? null);
  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 pt-8">
      <TopBar data={data} live={live} />
      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panel px-5 py-4">
        <p className="text-lg font-medium tracking-tight">{nowLine(cards, live)}</p>
        <p className="flex gap-4 text-sm">
          <span className="text-pass">{s.passed} pass</span><span className="text-fail">{s.failed} fail</span>
          {s.review > 0 && <span className="text-accent">{s.review} flaky</span>}<span className="text-muted">{s.proposed + s.ready + s.running} to go</span>
        </p>
      </section>
      <div className="mt-4 grid gap-4 lg:h-[calc(100vh-270px)] lg:min-h-[520px] lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav className="min-h-0 overflow-auto rounded-2xl border border-line bg-background p-2" aria-label="Requirements by feature">
          {groupByFeature(cards).map((g) => (
            <div key={g.feature} className="mb-2">
              <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{g.feature}</p>
              {g.cards.map((c) => (
                <button key={c.req.id} onClick={() => setPicked(c.req.id)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${sel?.req.id === c.req.id ? "bg-chip" : "hover:bg-panel"}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${laneDot[c.lane]}`} />
                  <span className="truncate">{shortLabel(c.req.text, 34)}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex min-h-0 flex-col gap-3">
          <LiveBrowser live={live} className="min-h-[280px] flex-1" />
          {sel && (
            <section className="rounded-2xl border border-line bg-background px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{shortLabel(sel.req.text, 80)}</p>
                {sel.check ? <Badge status={sel.check.status} /> : <span className="text-xs text-muted">{sel.lane === "proposed" ? "to review" : "ready"}</span>}
              </div>
              {claim && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{claim}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {sel.lane === "proposed" && <ReqActions r={sel.req} compact />}
                {sel.check?.status === "failed" && <Link className="text-sm font-medium text-accent hover:underline" href={`/t/${data.trailId}/checks/${sel.check.id}`}>Bug report →</Link>}
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer">Details</summary>
                  <div className="mt-2 max-w-3xl space-y-2"><p>{sel.req.text}</p>{saw && <p className="font-mono">Saw: {saw}</p>}{sel.req.quote && <p className="italic">&ldquo;{sel.req.quote}&rdquo;</p>}</div>
                </details>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
