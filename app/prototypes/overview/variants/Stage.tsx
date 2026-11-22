"use client";

import Link from "next/link";
import { useState } from "react";
import { seconds } from "@/components/ui";
import type { Data } from "../types";
import { Badge, LiveBrowser, ReqActions, TopBar, buildCards, summarize, useLive, verdictOf, verdictTone, chip, type Lane } from "../shared";

const dot: Record<Lane, string> = { proposed: "bg-accent", ready: "bg-muted/50", running: "bg-accent animate-pulse", passed: "bg-pass", attention: "bg-fail" };

export default function Stage({ data }: { data: Data }) {
  const live = useLive(data.trailId, data.live);
  const cards = buildCards(data, live);
  const s = summarize(cards);
  const v = verdictOf(cards);
  const first = cards.find((c) => c.lane === "attention") ?? cards.find((c) => c.lane === "running") ?? cards[0];
  const [picked, setPicked] = useState<string | null>(null);
  const sel = cards.find((c) => c.req.id === picked) ?? first;
  const timeline = live.checks.filter((c) => c.status !== "running");
  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 pt-8">
      <TopBar data={data} live={live} />
      <div className="mt-6 grid gap-4 lg:h-[calc(100vh-190px)] lg:min-h-[560px] lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        <aside className="flex min-h-0 flex-col rounded-2xl border border-line bg-background">
          <h2 className="px-4 pt-3.5 pb-2 text-xs font-medium uppercase tracking-wide text-muted">Requirements · {cards.length}</h2>
          <ul className="min-h-0 flex-1 overflow-auto px-2 pb-2">
            {cards.map((c) => (
              <li key={c.req.id}>
                <button onClick={() => setPicked(c.req.id)} className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] leading-snug transition-colors ${sel?.req.id === c.req.id ? "bg-chip" : "hover:bg-panel"}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[c.lane]}`} />
                  <span className="line-clamp-3">{c.req.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex min-h-0 flex-col gap-4">
          <LiveBrowser live={live} className="min-h-[300px] flex-[3]" />
          <section className="min-h-0 flex-[2] overflow-auto rounded-2xl border border-line bg-background p-5">
            {sel ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <p className="text-base font-medium leading-snug">{sel.req.text}</p>
                  {sel.check ? <Badge status={sel.check.status} /> : <span className={chip}>{sel.lane === "proposed" ? "to review" : "ready"}</span>}
                </div>
                {sel.req.supersedes && (
                  <p className="mt-3 rounded-lg bg-accent/5 px-3 py-2 text-sm"><span className="font-medium text-accent">Changes: </span><span className="text-muted line-through">{sel.req.supersedes.text}</span></p>
                )}
                {sel.check?.reason && <p className="mt-3 text-sm leading-relaxed text-muted">{sel.check.reason}</p>}
                {sel.req.quote && <p className="mt-3 border-l-2 border-line pl-3 text-sm italic text-muted">&ldquo;{sel.req.quote}&rdquo;</p>}
                <div className="mt-4 flex items-center gap-3">
                  {sel.lane === "proposed" && <ReqActions r={sel.req} />}
                  {sel.check?.status === "failed" && <Link className="text-sm font-medium text-accent hover:underline" href={`/t/${data.trailId}/checks/${sel.check.id}`}>Open bug report →</Link>}
                </div>
              </>
            ) : <p className="text-sm text-muted">No requirements yet.</p>}
          </section>
        </div>

        <aside className="flex min-h-0 flex-col gap-4 overflow-auto">
          <section className="rounded-2xl border border-line bg-background p-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Verdict</h2>
            <p className={`mt-2 text-lg font-semibold leading-snug ${verdictTone[v.verdict]}`}>{v.text.split("\n")[0]}</p>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-chip">
              <div className="bg-pass" style={{ flex: s.passed }} /><div className="bg-fail" style={{ flex: s.failed }} /><div className="bg-accent/60" style={{ flex: s.review }} /><div className="bg-muted/40" style={{ flex: s.errored }} />
            </div>
            <p className="mt-2 text-xs text-muted">{s.passed} pass · {s.failed} fail · {s.review} flaky · {s.proposed + s.ready} not run</p>
          </section>
          <section className="min-h-0 flex-1 overflow-auto rounded-2xl border border-line bg-background p-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted">This run</h2>
            <ol className="mt-3 space-y-3 border-l border-line pl-4">
              {timeline.map((c) => (
                <li key={c.id} className="relative text-[13px] leading-snug">
                  <span className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${c.status === "passed" ? "bg-pass" : c.status === "failed" ? "bg-fail" : "bg-muted/50"}`} />
                  <button className="text-left hover:underline" onClick={() => setPicked(c.requirementId)}>{c.requirement}</button>
                  <span className="ml-2 text-xs text-muted">{seconds(c.durationMs)}</span>
                </li>
              ))}
              {!timeline.length && <li className="text-sm text-muted">Results appear here as checks finish.</li>}
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}
