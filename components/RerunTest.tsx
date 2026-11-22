"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnGhost } from "./ui";

/** Runs one requirement again inside the latest run. Everything else keeps its result. */
export default function RerunTest({ trailId, requirementId, disabled = false, goToRun = false, onStart }: { trailId: string; requirementId: string; disabled?: boolean; goToRun?: boolean; onStart?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/trails/${trailId}/run`, { method: "POST", body: JSON.stringify({ requirementId }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error);
    onStart?.();
    if (goToRun) router.push(`/t/${trailId}`);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button className={btnGhost} onClick={start} disabled={busy || disabled} title={disabled ? "A run is in progress" : "Run only this test again"}>{busy ? "Starting..." : "Rerun this test"}</button>
      {error && <span className="text-xs text-fail">{error}</span>}
    </span>
  );
}
