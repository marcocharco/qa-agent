"use client";

import { useState } from "react";
import Calculator, { type AppliedCoupon } from "@/components/Calculator";
import { bugs } from "@/lib/bugs";
import type { Billing } from "@/lib/pricing";

export default function Pricing() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Simple pricing for teams</h1>
      <p className="mt-2 text-neutral-600">Pick a plan, add your seats, start a free trial.</p>

      <div className="mt-6 flex items-center gap-3">
        <button
          className={`rounded-full border px-4 py-1 ${billing === "monthly" ? "bg-black text-white" : ""}`}
          onClick={() => setBilling("monthly")}
        >
          Monthly
        </button>
        <button
          className={`rounded-full border px-4 py-1 ${billing === "annual" ? "bg-black text-white" : ""}`}
          onClick={() => setBilling("annual")}
        >
          Annual
        </button>
        {billing === "annual" && <span className="rounded bg-green-100 px-2 py-0.5 text-sm text-green-800">Save 20%</span>}
      </div>

      {/* BUG seatsResetOnToggle: keying on billing remounts Calculator and drops its seat state. */}
      <Calculator key={bugs.seatsResetOnToggle ? billing : "calc"} billing={billing} coupon={coupon} onCoupon={setCoupon} />
    </main>
  );
}
