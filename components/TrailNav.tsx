"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { TrailRow } from "@/lib/queries";

export function TrailPicker({ trails, current }: { trails: Pick<TrailRow, "id" | "title" | "state">[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const tab = pathname.split("/")[3] === "run" ? "/run" : "";
  return (
    <select
      aria-label="Trail"
      value={current}
      onChange={(e) => router.push(`/t/${e.target.value}${tab}`)}
      className="max-w-full rounded-full border border-line bg-background py-1.5 pl-4 pr-8 text-sm font-medium outline-none focus:border-foreground"
    >
      {trails.map((t) => (
        <option key={t.id} value={t.id}>{t.title}{t.state === "merged" ? " (merged)" : ""}</option>
      ))}
    </select>
  );
}

export function Steps({ trailId }: { trailId: string }) {
  const pathname = usePathname();
  const onRequirements = pathname === `/t/${trailId}`;
  const items = [
    { href: `/t/${trailId}`, label: "Requirements", on: onRequirements },
    { href: `/t/${trailId}/run`, label: "Live run", on: !onRequirements },
  ];
  return (
    <nav className="flex gap-6 border-b border-line">
      {items.map((i, n) => (
        <Link key={i.href} href={i.href} className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-medium ${i.on ? "border-foreground" : "border-transparent text-muted hover:text-foreground"}`}>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${i.on ? "bg-foreground text-background" : "bg-chip"}`}>{n + 1}</span>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
