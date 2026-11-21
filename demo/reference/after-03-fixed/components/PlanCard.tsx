"use client";

import { useState } from "react";
import { MAX_SEATS, quote, usd, type Billing, type Plan } from "@/lib/pricing";

export type AppliedCoupon = { code: string; rate: number };

const FEATURES: Record<Plan["id"], string[]> = {
  pro: ["1 to 50 seats", "Email support"],
  team: ["3 to 50 seats", "5% off at 10 or more seats", "Priority support"],
};
const BLURB: Record<Plan["id"], string> = {
  pro: "For small teams getting started.",
  team: "For growing teams that want volume pricing.",
};

const muted = "text-sm text-muted";
const step =
  "flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg transition-colors hover:bg-chip";

export default function PlanCard(props: { plan: Plan; billing: Billing; coupon: AppliedCoupon | null; featured?: boolean }) {
  const { plan, billing, coupon, featured } = props;
  const [seats, setSeats] = useState(plan.minSeats);

  const q = quote(plan, seats, billing, coupon?.rate ?? 0);
  const unit = billing === "annual" ? "year" : "month";

  return (
    <div className={`relative flex flex-col rounded-xl border bg-panel p-7 ${featured ? "border-accent" : "border-line"}`}>
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-background">
          Most popular
        </span>
      )}

      <h2 className="text-xl font-semibold">{plan.name}</h2>
      <p className={`mt-1 ${muted}`}>{BLURB[plan.id]}</p>

      <p className="mt-6">
        <span className={muted}>Price per seat: </span>
        <span className="text-2xl font-semibold tabular-nums">{usd(q.perSeatCents)}</span>
        <span className={muted}> per month</span>
      </p>

      <div className="mt-6 flex items-center justify-between border-t border-line pt-6">
        <span className={muted}>{plan.name} seats</span>
        <div className="flex items-center gap-3">
          <button
            aria-label={`Decrease ${plan.name} seats`}
            className={step}
            onClick={() => setSeats((s) => Math.max(plan.minSeats, s - 1))}
          >
            −
          </button>
          <span aria-label={`${plan.name} seat count`} className="min-w-8 text-center text-2xl font-semibold tabular-nums">
            {seats}
          </span>
          <button
            aria-label={`Increase ${plan.name} seats`}
            className={step}
            onClick={() => setSeats((s) => Math.min(MAX_SEATS, s + 1))}
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-6">
        <p>
          <span className={muted}>Total: </span>
          <span className="text-4xl font-semibold tracking-tight tabular-nums">{usd(q.totalCents)}</span>
          <span className={muted}> per {unit}</span>
        </p>
        {billing === "annual" && <p className={`mt-1 ${muted}`}>Billed {usd(q.totalCents)} yearly</p>}
        <div className={`mt-4 space-y-1 ${muted}`}>
          <p>Subtotal: {usd(q.subtotalCents)}</p>
          {q.volumeCents > 0 && <p>Volume discount (5%): -{usd(q.volumeCents)}</p>}
          {q.couponCents > 0 && coupon && <p>Discount ({coupon.code}): -{usd(q.couponCents)}</p>}
        </div>
      </div>

      <ul className="my-6 space-y-2 border-t border-line pt-6 text-sm">
        {FEATURES[plan.id].map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-muted">✓</span>
            {f}
          </li>
        ))}
      </ul>

      <button className="mt-auto w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90">
        Start free trial
      </button>
    </div>
  );
}
