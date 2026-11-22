"use client";

import { useState } from "react";
import { btn } from "./ui";

/** Copies the report as a PR description. The origin is read in the browser so links match wherever the report is open. */
export default function CopyReport({ markdown }: { markdown: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className={btn} onClick={async () => {
      await navigator.clipboard.writeText(markdown.replaceAll("https://REPORT_ORIGIN", location.origin));
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    }}>{done ? "Copied" : "Copy as PR description"}</button>
  );
}
