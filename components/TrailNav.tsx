"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { TrailRow } from "@/lib/queries";

export function TrailPicker({ trails, current }: { trails: Pick<TrailRow, "id" | "title" | "state">[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const seg = pathname.split("/")[3];
  const tab = seg === "requirements" || seg === "history" ? `/${seg}` : "";
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

export function TrailTabs({ trailId }: { trailId: string }) {
  const pathname = usePathname();
  const seg = pathname.split("/")[3];
  const items = [
    { href: `/t/${trailId}`, label: "Run", on: !seg || seg === "run" || seg === "checks" },
    { href: `/t/${trailId}/requirements`, label: "Requirements", on: seg === "requirements" },
    { href: `/t/${trailId}/history`, label: "History", on: seg === "history" },
  ];
  return (
    <nav className="flex gap-6 border-b border-line">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={`-mb-px border-b-2 pb-3 text-sm font-medium ${i.on ? "border-foreground" : "border-transparent text-muted hover:text-foreground"}`}>{i.label}</Link>
      ))}
    </nav>
  );
}
