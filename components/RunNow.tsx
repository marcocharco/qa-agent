"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { btn } from "./ui";

/** Starts a run, and turns into a Stop button while one is going. `running` is the parent's view (open run); we also track our own click. */
export default function RunNow({ trailId, goToRun = true, label = "Run now", running = false, onStart }: { trailId: string; goToRun?: boolean; label?: string; running?: boolean; onStart?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState(false);
  const [error, setError] = useState("");
  const active = running || mine;

  // After our own start, follow the job until it ends (the parent may not poll, e.g. on the Requirements tab).
  useEffect(() => {
    if (!mine) return;
    const t = setInterval(async () => {
      try { if (!(await (await fetch(`/api/trails/${trailId}/run`)).json()).running) setMine(false); } catch { /* retry */ }
    }, 3000);
    return () => clearInterval(t);
  }, [mine, trailId]);

  async function start() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/trails/${trailId}/run`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error);
    setMine(true);
    onStart?.();
    if (goToRun) router.push(`/t/${trailId}`);
  }

  async function stop() {
    setBusy(true);
    await fetch(`/api/trails/${trailId}/run`, { method: "DELETE" });
    setBusy(false);
    setMine(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {active
        ? <button className="inline-flex items-center justify-center rounded-full border border-fail/50 px-5 py-2 text-sm font-medium text-fail transition-colors hover:bg-fail/10 disabled:opacity-40" onClick={stop} disabled={busy}>{busy ? "Stopping..." : "Stop"}</button>
        : <button className={btn} onClick={start} disabled={busy}>{busy ? "Starting..." : label}</button>}
      {error && <p className="max-w-xs text-right text-xs text-fail">{error}</p>}
    </div>
  );
}
