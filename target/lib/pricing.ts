import { bugs } from "./bugs";

export type Billing = "monthly" | "annual";

export const PLANS = [
  { id: "pro", name: "Pro", cents: 1900 },
  { id: "team", name: "Team", cents: 2900 },
] as const;

export const ANNUAL_FACTOR = 0.8;
export const COUPONS: Record<string, number> = { SAVE10: 0.1 };

export const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export type Quote = {
  perSeatCents: number; // shown as "per seat per month"
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  months: number;
};

export function quote(o: { planCents: number; seats: number; billing: Billing; couponRate: number }): Quote {
  const months = o.billing === "annual" ? 12 : 1;
  const exactPerSeat = o.planCents * (o.billing === "annual" ? ANNUAL_FACTOR : 1);
  // BUG roundedSeatPrice: the total uses a whole-dollar seat price, the label uses the exact one.
  const billedPerSeat = bugs.roundedSeatPrice ? Math.round(exactPerSeat / 100) * 100 : exactPerSeat;
  const subtotalCents = Math.round(billedPerSeat * o.seats * months);
  const discountCents = Math.round(subtotalCents * o.couponRate);
  return {
    perSeatCents: exactPerSeat,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    months,
  };
}
