"use client";

import { useState, useTransition } from "react";
import { editText, setStatus } from "@/app/actions";
import type { RequirementRow as Req } from "@/lib/queries";
import ReceiptChip from "./Receipt";
import { btnGhost, chip, input } from "./ui";

const statusTone: Record<Req["status"], string> = {
  proposed: "bg-accent/10 text-accent",
  approved: "bg-pass/10 text-pass",
  rejected: "bg-chip text-muted line-through",
  superseded: "bg-chip text-muted",
};

export default function RequirementRow({ r, showTrail = false, select }: { r: Req; showTrail?: boolean; select?: { checked: boolean; onChange: () => void } }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.text);
  const [pending, start] = useTransition();
  const [warning, setWarning] = useState<string | null>(null);
  const act = (f: () => Promise<string | null>) => start(async () => setWarning(await f()));
  const dim = !r.testable || r.status === "rejected" || r.status === "superseded";

  const save = () => start(async () => { setWarning(await editText(r.id, text)); setEditing(false); });

  return (
    <li className={`grid gap-3 py-5 md:grid-cols-[1fr_auto] md:gap-8 ${select ? "md:grid-cols-[auto_1fr_auto]" : ""} ${pending ? "opacity-60" : ""}`}>
      {select && <input type="checkbox" className="mt-1.5 h-4 w-4 accent-foreground" checked={select.checked} onChange={select.onChange} aria-label="Select requirement" />}
      <div className={dim ? "opacity-60" : ""}>
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea className={input} rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button className={btnGhost} onClick={save} disabled={pending}>Save</button>
              <button className={btnGhost} onClick={() => { setText(r.text); setEditing(false); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="text-[15px] leading-relaxed">
            <span className={r.status === "rejected" ? "line-through" : ""}>{r.text}</span>
            {r.sourceKind !== "manual" && <ReceiptChip requirementId={r.id} kind={r.sourceKind} />}
          </div>
        )}
        {r.supersedes && r.status === "proposed" && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
            <p className="font-medium text-accent">Changes an earlier requirement</p>
            <p className="mt-1 text-muted line-through">{r.supersedes.text}</p>
            <p className="mt-1">{r.text}</p>
            <p className="mt-1 text-muted">Approving replaces the earlier one and stops testing it.</p>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[r.status]}`}>{r.status}</span>
          <span className={chip}>{r.type}</span>
          <span className={chip}>{Math.round(r.confidence * 100)}% confident</span>
          {r.edited && <span className={chip}>edited</span>}
          {showTrail && <span className={chip}>{r.trailTitle}</span>}
          {r.sourceKind === "manual" && <span className={chip}>added by hand</span>}
        </div>
        {warning && <p className="mt-2 text-sm text-fail">{warning}</p>}
        {!r.testable && !r.supersedes && <p className="mt-2 text-sm text-muted">Not tested: {r.untestableReason ?? "no reason given"}</p>}
      </div>
      <div className="flex flex-wrap items-start gap-2 md:justify-end">
        {!editing && <button className={btnGhost} onClick={() => setEditing(true)}>Edit</button>}
        {r.testable && (r.status === "proposed" || r.status === "rejected") && <button className={btnGhost} disabled={pending} onClick={() => act(() => setStatus(r.id, "approved"))}>{r.supersedes ? "Approve change" : "Approve"}</button>}
        {r.status !== "rejected" && <button className={btnGhost} disabled={pending} onClick={() => act(() => setStatus(r.id, "rejected"))}>Reject</button>}
        {r.status === "rejected" && <button className={btnGhost} disabled={pending} onClick={() => act(() => setStatus(r.id, "proposed"))}>Restore</button>}
      </div>
    </li>
  );
}
