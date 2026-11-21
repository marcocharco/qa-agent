"use client";

import { useState } from "react";
import { bugs } from "@/lib/bugs";
import { COUPONS, PLANS, quote, usd, type Billing } from "@/lib/pricing";

export type AppliedCoupon = { code: string; rate: number; snapshotCents: number };

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
    <section className="mt-8 rounded-xl border p-6">
      <div className="flex gap-3">
        {PLANS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPlanId(p.id)}
            className={`rounded-lg border px-4 py-2 ${p.id === planId ? "bg-black text-white" : ""}`}
          >
            {p.name} {usd(p.cents)}/seat/mo
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span>Seats</span>
        <button aria-label="Decrease seats" className="rounded border px-3" onClick={() => setSeats((s) => Math.max(1, s - 1))}>
          -
        </button>
        <span aria-label="Seat count">{seats}</span>
        <button aria-label="Increase seats" className="rounded border px-3" onClick={() => setSeats((s) => Math.min(50, s + 1))}>
          +
        </button>
      </div>

      <div className="mt-6 space-y-1">
        <p>{plan.name} plan, {seats} {seats === 1 ? "seat" : "seats"}</p>
        <p>Price per seat: {usd(q.perSeatCents)} per month</p>
        <p>Subtotal: {usd(q.subtotalCents)}</p>
        {coupon && <p>Discount ({coupon.code}): -{usd(discountCents)}</p>}
        <p className="text-xl font-semibold">Total: {usd(totalCents)} per {unit}</p>
        {billing === "annual" && <p className="text-sm text-neutral-600">Billed {usd(totalCents)} yearly</p>}
      </div>

      <div className="mt-6 flex gap-2">
        <input className="rounded border px-2" placeholder="Coupon code" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
        <button className="rounded border px-3" onClick={applyCoupon}>Apply</button>
      </div>
      {codeMsg && <p className="mt-1">{codeMsg}</p>}

      <div className="mt-6 flex gap-2">
        <input className="rounded border px-2" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="rounded bg-black px-4 py-1 text-white" onClick={startTrial}>Start free trial</button>
      </div>
      {emailMsg && <p className="mt-1">{emailMsg}</p>}
    </section>
  );
}
