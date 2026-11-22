"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./picker.css";
import type { Data } from "./types";
import Focus from "./variants/Focus";
import Phase from "./variants/Phase";
import Stage from "./variants/Stage";
import Tabs from "./variants/Tabs";

const VARIANTS = [
  { name: "Stage", C: Stage },
  { name: "Focus", C: Focus },
  { name: "Phase", C: Phase },
  { name: "Tabs", C: Tabs },
];

export default function Harness({ data, initial }: { data: Data; initial: number }) {
  const [cur, setCur] = useState(initial >= 0 && initial < VARIANTS.length ? initial : 0);
  const nav = useRef<HTMLElement>(null);
  const hl = useRef<HTMLSpanElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const move = () => {
    const el = items.current[cur];
    if (!el || !hl.current) return;
    hl.current.style.width = `${el.offsetWidth}px`;
    hl.current.style.transform = `translateX(${el.offsetLeft}px)`;
  };
  useLayoutEffect(move);

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set("v", String(cur + 1));
    history.replaceState(null, "", url);
  }, [cur]);

  useEffect(() => {
    const onResize = () => move();
    window.addEventListener("resize", onResize);
    // The slide is enabled only after first paint so load does not animate.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => nav.current?.setAttribute("data-ready", "")));
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(id); };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= VARIANTS.length) setCur(n - 1);
      else if (e.key === "ArrowRight") setCur((c) => (c + 1) % VARIANTS.length);
      else if (e.key === "ArrowLeft") setCur((c) => (c - 1 + VARIANTS.length) % VARIANTS.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const Active = VARIANTS[cur].C;
  return (
    <>
      <div className="pb-24"><Active key={cur} data={data} /></div>
      <nav ref={nav} className="proto-picker" aria-label="Prototype variants">
        <span ref={hl} className="proto-picker-highlight" aria-hidden="true" />
        {VARIANTS.map((v, i) => (
          <button key={v.name} ref={(el) => { items.current[i] = el; }} className="proto-picker-item" onClick={() => setCur(i)}
            {...(i === cur ? { "data-active": "", "aria-current": "true" as const } : {})}>{v.name}</button>
        ))}
      </nav>
    </>
  );
}
