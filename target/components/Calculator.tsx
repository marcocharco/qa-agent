"use client";

import { useState } from "react";
import { bugs } from "@/lib/bugs";
import { COUPONS, PLANS, quote, usd, type Billing } from "@/lib/pricing";

export type AppliedCoupon = { code: string; rate: number; snapshotCents: number };

const label = "text-sm text-muted";
const input =
  "min-w-0 flex-1 rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-muted";
const primary =
  "whitespace-nowrap rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90";
const secondary = "whitespace-nowrap rounded-full border border-line px-5 py-2 text-sm font-medium transition-colors hover:bg-chip";
const step =
  "flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg transition-colors hover:bg-chip";

export default function Calculator(props: {
  billing: Billing;
  coupon: AppliedCoupon | null;
  onCoupon: (c: AppliedCoupon) => void;
}) {
  const { billing, coupon, onCoupon } = props;
  const [seats, setSeats] = useState(1);
  const [planId, setPlanId] = useState<(typeof PLANS)[number]["id"]>("pro");
  const [codeInput, setCodeInput] = useState("");
  const [codeMsg, setCodeMsg] = useState("");
  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState("");

  const plan = PLANS.find((p) => p.id === planId)!;
  const q = quote({ planCents: plan.cents, seats, billing, couponRate: coupon?.rate ?? 0 });
  // BUG staleCoupon: the discount is the amount captured at apply time, not derived from current seats and billing.
  const discountCents = coupon ? (bugs.staleCoupon ? coupon.snapshotCents : q.discountCents) : 0;
  const totalCents = q.subtotalCents - discountCents;
  const unit = billing === "annual" ? "year" : "month";

  function applyCoupon() {
    const rate = COUPONS[codeInput.trim().toUpperCase()];
    if (!rate) return setCodeMsg("Invalid code");
    const snap = quote({ planCents: plan.cents, seats, billing, couponRate: rate });
    onCoupon({ code: codeInput.trim().toUpperCase(), rate, snapshotCents: snap.discountCents });
    setCodeMsg(`${codeInput.trim().toUpperCase()} applied: 10% off`);
  }

  function startTrial() {
    if (!email.includes("@")) return setEmailMsg("Enter a valid email address");
    setEmailMsg(`Trial started for ${email}`);
  }

  return (
    <section className="mt-16">
      <div className="relative z-10 -mb-px inline-block rounded-t-lg border border-b-0 border-line bg-panel px-4 py-2 text-sm">
        Estimate
      </div>

      <div className="divide-y divide-line rounded-b-lg rounded-tr-lg border border-line bg-panel">
      <div className="grid grid-cols-1 md:grid-cols-3 md:divide-x md:divide-line">
        <div className="p-7">
          <p className={label}>Plan</p>
          <div className="mt-4 space-y-3">
            {PLANS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlanId(p.id)}
                className={`block w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  p.id === planId ? "border-accent bg-background" : "border-line hover:bg-chip"
                }`}
              >
                <span className="block font-medium">{p.name}</span>
                <span className="block text-sm text-muted">{usd(p.cents)} per seat per month</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-line p-7 md:border-t-0">
          <p className={label}>Seats</p>
          <div className="mt-4 flex items-center gap-4">
            <button aria-label="Decrease seats" className={step} onClick={() => setSeats((s) => Math.max(1, s - 1))}>
              −
            </button>
            <span aria-label="Seat count" className="min-w-10 text-center text-4xl font-semibold tabular-nums">
              {seats}
            </span>
            <button aria-label="Increase seats" className={step} onClick={() => setSeats((s) => Math.min(50, s + 1))}>
              +
            </button>
          </div>
          <p className="mt-4 text-sm text-muted">Between 1 and 50 seats.</p>
        </div>

        <div className="border-t border-line p-7 md:border-t-0">
          <p className={label}>
            {plan.name} plan, {seats} {seats === 1 ? "seat" : "seats"}
          </p>
          <p className="mt-4">
            <span className="text-sm text-muted">Total: </span>
            <span className="text-4xl font-semibold tracking-tight tabular-nums">{usd(totalCents)}</span>
            <span className="text-sm text-muted"> per {unit}</span>
          </p>
          {billing === "annual" && <p className="mt-1 text-sm text-muted">Billed {usd(totalCents)} yearly</p>}
          <div className="mt-5 space-y-1 border-t border-line pt-4 text-sm text-muted">
            <p>Price per seat: {usd(q.perSeatCents)} per month</p>
            <p>Subtotal: {usd(q.subtotalCents)}</p>
            {coupon && <p>Discount ({coupon.code}): -{usd(discountCents)}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-line">
        <div className="p-7">
          <p className={label}>Coupon</p>
          <div className="mt-3 flex gap-2">
            <input className={input} placeholder="Coupon code" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
            <button className={secondary} onClick={applyCoupon}>Apply</button>
          </div>
          {codeMsg && <p className="mt-2 text-sm text-muted">{codeMsg}</p>}
        </div>
        <div className="border-t border-line p-7 md:border-t-0">
          <p className={label}>Free trial</p>
          <div className="mt-3 flex gap-2">
            <input className={input} placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className={primary} onClick={startTrial}>Start free trial</button>
          </div>
          {emailMsg && <p className="mt-2 text-sm text-muted">{emailMsg}</p>}
          <div className="mt-4 flex gap-2">
            <span className="rounded bg-chip px-2 py-0.5 text-xs text-muted">14-day trial</span>
            <span className="rounded bg-chip px-2 py-0.5 text-xs text-muted">Cancel anytime</span>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
