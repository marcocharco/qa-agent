"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn } from "./ui";

export default function RunNow({ trailId, goToRun = true, label = "Run now" }: { trailId: string; goToRun?: boolean; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/trails/${trailId}/run`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error);
    if (goToRun) router.push(`/t/${trailId}`);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button className={btn} onClick={start} disabled={busy}>{busy ? "Starting..." : label}</button>
      {error && <p className="max-w-xs text-right text-xs text-fail">{error}</p>}
    </div>
  );
}
