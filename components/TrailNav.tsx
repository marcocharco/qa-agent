"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
