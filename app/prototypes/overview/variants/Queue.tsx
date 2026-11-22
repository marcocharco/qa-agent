"use client";

import Link from "next/link";
import { useState } from "react";
import type { Data } from "../types";
import { Badge, LANES, LiveBrowser, ReqActions, TopBar, buildCards, summarize, useLive, verdictOf, verdictTone, type Card, type Lane } from "../shared";

type Item = { key: string; kind: "Drift" | "Failed" | "Flaky" | "No verdict" | "To review"; c: Card };

const kindTone: Record<Item["kind"], string> = {
  Drift: "bg-accent/10 text-accent", Failed: "bg-fail/10 text-fail", Flaky: "bg-accent/10 text-accent", "No verdict": "bg-chip text-muted", "To review": "bg-chip text-foreground",
};
const order: Item["kind"][] = ["Failed", "Drift", "Flaky", "No verdict", "To review"];

export default function Queue({ data }: { data: Data }) {
  const live = useLive(data.trailId, data.live);
  const cards = buildCards(data, live);
  const s = summarize(cards);
  const v = verdictOf(cards);
  const [open, setOpen] = useState<Lane | null>(null);

  const items: Item[] = cards.flatMap((c): Item[] => {
    if (c.check?.status === "failed") return [{ key: c.req.id, kind: "Failed", c }];
    if (c.check?.status === "review") return [{ key: c.req.id, kind: "Flaky", c }];
    if (c.check?.status === "errored") return [{ key: c.req.id, kind: "No verdict", c }];
    if (c.lane === "proposed") return [{ key: c.req.id, kind: c.req.supersedes ? "Drift" : "To review", c }];
    return [];
  }).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  return (
    <main className="mx-auto w-full max-w-[1300px] px-6 pt-8">
      <TopBar data={data} live={live} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <h2 className="text-3xl font-semibold tracking-tight">{items.length ? `${items.length} ${items.length === 1 ? "thing needs" : "things need"} you` : "Nothing needs you"}</h2>
          <p className="mt-1 text-muted">Most urgent first. Each one can be settled right here.</p>
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {items.map(({ key, kind, c }) => (
              <li key={key} className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:gap-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${kindTone[kind]}`}>{kind}</span>
                    <span className="text-xs text-muted">{c.regression ? "regression" : "new"}</span>
                  </div>
                  <p className="mt-2 text-[15px] leading-snug">{c.req.text}</p>
                  {kind === "Drift" && <p className="mt-1.5 text-sm text-muted">Replaces: <span className="line-through">{c.req.supersedes!.text}</span></p>}
                  {c.check?.reason && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{c.check.reason}</p>}
                </div>
                <div className="flex items-start gap-3 md:justify-end">
                  {kind === "Failed" && <Link className="inline-flex h-8 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background" href={`/t/${data.trailId}/checks/${c.check!.id}`}>Open bug report</Link>}
                  {(kind === "Drift" || kind === "To review") && <ReqActions r={c.req} />}
                </div>
              </li>
            ))}
          </ul>

          <h3 className="mt-10 text-sm font-medium uppercase tracking-wide text-muted">Everything else</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {LANES.filter((l) => l.id !== "attention" && l.id !== "proposed").map((l) => {
              const n = cards.filter((c) => c.lane === l.id).length;
              return <button key={l.id} onClick={() => setOpen(open === l.id ? null : l.id)} className={`rounded-full border px-3.5 py-1.5 text-sm ${open === l.id ? "border-foreground bg-foreground text-background" : "border-line hover:bg-chip"}`}>{l.title} {n}</button>;
            })}
          </div>
          {open && (
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
              {cards.filter((c) => c.lane === open).map((c) => (
                <li key={c.req.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm"><span className="leading-snug">{c.req.text}</span>{c.check && <Badge status={c.check.status} />}</li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <LiveBrowser live={live} className="aspect-video" />
          <section className="rounded-2xl border border-line bg-panel p-5">
            <p className={`text-lg font-semibold leading-snug ${verdictTone[v.verdict]}`}>{v.text.split("\n")[0]}</p>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-chip">
              <div className="bg-pass" style={{ flex: s.passed }} /><div className="bg-fail" style={{ flex: s.failed }} /><div className="bg-accent/60" style={{ flex: s.review }} />
              <div className="bg-accent" style={{ flex: s.running }} /><div className="bg-muted/40" style={{ flex: s.proposed + s.ready + s.errored }} />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-y-1 text-xs text-muted">
              <dt>Passing</dt><dt>Failing</dt><dt>Not run</dt>
              <dd className="text-lg font-semibold text-pass">{s.passed}</dd><dd className="text-lg font-semibold text-fail">{s.failed}</dd><dd className="text-lg font-semibold text-foreground">{s.proposed + s.ready}</dd>
            </dl>
            <p className="mt-3 text-xs text-muted">{data.coverage.untestable.length} {data.coverage.untestable.length === 1 ? "ask cannot" : "asks cannot"} be tested ({data.coverage.untestable[0]?.text.slice(0, 40)}...)</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
