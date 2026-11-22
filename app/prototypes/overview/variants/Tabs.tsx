"use client";

import { useState } from "react";
import type { Data } from "../types";
import { LiveBrowser, ReqActions, ResultList, TopBar, buildCards, groupByFeature, laneDot, nowLine, phaseOf, shortLabel, summarize, useLive } from "../shared";

type Tab = "watch" | "results" | "requirements";

export default function Tabs({ data }: { data: Data }) {
  const live = useLive(data.trailId, data.live);
  const cards = buildCards(data, live);
  const s = summarize(cards);
  const [tab, setTab] = useState<Tab>(phaseOf(live) === "running" ? "watch" : "results");
  const todo = s.failed + s.review + s.errored;
  const tabs: [Tab, string, number | null][] = [["watch", "Watch", s.running || null], ["results", "Results", todo || null], ["requirements", "Requirements", cards.length]];
  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pt-8">
      <TopBar data={data} live={live} />
      <p className="mt-6 text-xl font-medium tracking-tight">{nowLine(cards, live)}</p>
      <div role="tablist" className="mt-5 flex gap-1 border-b border-line">
        {tabs.map(([id, label, n]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === id ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground"}`}>
            {label}{n != null && <span className={`rounded-full px-2 py-0.5 text-xs ${id === "results" && todo ? "bg-fail/10 text-fail" : "bg-chip text-muted"}`}>{n}</span>}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "watch" && <LiveBrowser live={live} className="h-[calc(100vh-330px)] min-h-[400px]" />}
        {tab === "results" && <ResultList cards={cards} trailId={data.trailId} />}
        {tab === "requirements" && (
          <div className="space-y-6">
            {groupByFeature(cards).map((g) => (
              <section key={g.feature}>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{g.feature}</h3>
                <ul className="divide-y divide-line border-y border-line">
                  {g.cards.map((c) => (
                    <li key={c.req.id} className="flex items-start gap-3 py-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${laneDot[c.lane]}`} />
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{shortLabel(c.req.text, 70)}</p><p className="mt-0.5 line-clamp-1 text-xs text-muted">{c.req.text}</p></div>
                      {c.lane === "proposed" && <ReqActions r={c.req} compact />}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
