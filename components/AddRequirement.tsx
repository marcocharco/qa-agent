"use client";

import { useState, useTransition } from "react";
import { addRequirement } from "@/app/actions";
import type { RequirementRow } from "@/lib/queries";
import { btn, input } from "./ui";

export default function AddRequirement({ trailId }: { trailId: string }) {
  const [text, setText] = useState("");
  const [type, setType] = useState<RequirementRow["type"]>("behaviour");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => start(async () => {
    const err = await addRequirement(trailId, text, type);
    setError(err);
    if (!err) setText("");
  });

  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <input className={input} placeholder="Add a requirement of your own, e.g. The cart survives a refresh" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <select className={`${input} md:w-40`} value={type} onChange={(e) => setType(e.target.value as RequirementRow["type"])} aria-label="Type">
          {["behaviour", "validation", "access", "visual"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className={btn} onClick={submit} disabled={pending}>Add</button>
      </div>
      {error && <p className="mt-2 text-sm text-fail">{error}</p>}
    </div>
  );
}
