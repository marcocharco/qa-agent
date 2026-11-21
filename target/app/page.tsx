"use client";

import { useState } from "react";
import PlanCard, { type AppliedCoupon } from "@/components/PlanCard";
import { COUPONS, PLANS, type Billing } from "@/lib/pricing";

const seg = (on: boolean) =>
  `rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${on ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`;

export default function Pricing() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeMsg, setCodeMsg] = useState("");

  function applyCoupon() {
    const code = codeInput.trim().toUpperCase();
    const rate = COUPONS[code];
    if (!rate) return setCodeMsg("Invalid code");
    setCoupon({ code, rate });
    setCodeMsg(`${code} applied: 10% off`);
  }

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-6 text-2xl font-bold tracking-tight">ACME</div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-24 pt-20">
        <div className="text-center">
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">Pricing</h1>
          <p className="mx-auto mt-5 max-w-md text-lg text-muted">Pick a plan, add your seats, start a free trial.</p>

          <div className="mt-8 flex justify-center">
            <div className="relative inline-flex">
              <div className="inline-flex rounded-full border border-line bg-panel p-1">
                <button className={seg(billing === "monthly")} onClick={() => setBilling("monthly")}>
                  Monthly
                </button>
                <button className={seg(billing === "annual")} onClick={() => setBilling("annual")}>
                  Annual
                </button>
              </div>
              {billing === "annual" && (
                <span className="absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded border border-accent px-2 py-0.5 text-xs text-accent">
                  Save 20%
                </span>
              )}
            </div>
          </div>

          <div className="mx-auto mt-5 flex max-w-xs gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-muted"
              placeholder="Coupon code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
            />
            <button className="whitespace-nowrap rounded-full border border-line px-5 py-2 text-sm font-medium transition-colors hover:bg-chip" onClick={applyCoupon}>
              Apply
            </button>
          </div>
          <p className="mt-2 h-5 text-sm text-muted">{codeMsg}</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} billing={billing} coupon={coupon} featured={p.id === "team"} />
          ))}
        </div>
      </main>
    </>
  );
}
