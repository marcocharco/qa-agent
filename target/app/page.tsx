"use client";

import { useState } from "react";
import Calculator, { type AppliedCoupon } from "@/components/Calculator";
import { bugs } from "@/lib/bugs";
import type { Billing } from "@/lib/pricing";

const seg = (on: boolean) =>
  `rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${on ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`;

export default function Pricing() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-6 font-semibold tracking-tight">Northwind</div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-24 pt-20">
        <div className="text-center">
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">Pricing</h1>
          <p className="mx-auto mt-5 max-w-md text-lg text-muted">
            Pick a plan, add your seats, start a free trial.
          </p>

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
        </div>

        {/* BUG seatsResetOnToggle: keying on billing remounts Calculator and drops its seat state. */}
        <Calculator key={bugs.seatsResetOnToggle ? billing : "calc"} billing={billing} coupon={coupon} onCoupon={setCoupon} />
      </main>
    </>
  );
}
