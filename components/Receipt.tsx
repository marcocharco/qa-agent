"use client";

import { useRef, useState } from "react";
import type { ReceiptMessage } from "@/lib/report";
import { btnGhost } from "./ui";

type Receipt = { label: string; quote: string | null; note: string | null; messages: ReceiptMessage[] };

/** The "session source" link: opens the chat message a requirement came from, in context. An action, so it is not styled as a chip. */
export default function ReceiptChip({ requirementId, kind }: { requirementId: string; kind: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Receipt | null>(null);

  async function open() {
    dialog.current?.showModal();
    if (!data) setData(await (await fetch(`/api/requirements/${requirementId}/receipt`)).json());
  }

  return (
    <>
      <button onClick={open} className="ml-3 inline-flex items-center gap-1.5 align-baseline text-sm font-medium text-accent underline-offset-4 hover:underline" aria-haspopup="dialog">
        {kind === "description" ? "Description source" : "Session source"}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 8V4.5A1.5 1.5 0 0 0 12.5 3h-9A1.5 1.5 0 0 0 2 4.5v6A1.5 1.5 0 0 0 3.5 12H7" /><rect x="9" y="9" width="5" height="4" rx="1" /></svg>
      </button>
      <dialog ref={dialog} onClick={(e) => e.target === dialog.current && dialog.current?.close()} className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-line bg-background p-0 text-foreground shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="text-sm font-medium">{data?.label ?? "Loading..."}</div>
          <button className={btnGhost} onClick={() => dialog.current?.close()}>Close</button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-6 py-5">
          {data?.quote && <p className="border-l-2 border-accent pl-3 text-sm italic text-muted">&ldquo;{data.quote}&rdquo;</p>}
          {data?.note && <p className="text-sm text-muted">{data.note}</p>}
          {data?.messages.map((m) => (
            <div key={m.id} className={`rounded-xl px-4 py-3 text-sm ${m.highlight ? "border border-accent bg-accent/5" : "bg-panel text-muted"}`}>
              <div className="mb-1 text-xs font-semibold text-muted">{m.role === "user" ? "You" : "Agent"}</div>
              <p className="whitespace-pre-wrap">{m.text.length > 700 ? m.text.slice(0, 700) + "..." : m.text}</p>
            </div>
          ))}
        </div>
      </dialog>
    </>
  );
}
