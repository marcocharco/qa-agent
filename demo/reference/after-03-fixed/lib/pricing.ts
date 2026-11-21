export type Billing = "monthly" | "annual";

const ANNUAL_FACTOR = 0.8;
const MONTHS_PER_YEAR = 12;
export const MAX_SEATS = 50;
export const COUPONS: Record<string, number> = { SAVE10: 0.1 };

export type Plan = {
  id: "pro" | "team";
  name: string;
  cents: number; // per seat per month
  minSeats: number;
  volume: { atSeats: number; rate: number } | null; // discount applies at this many seats or more
};

export const PLANS: Plan[] = [
  { id: "pro", name: "Pro", cents: 1900, minSeats: 1, volume: null },
  { id: "team", name: "Team", cents: 2900, minSeats: 3, volume: { atSeats: 10, rate: 0.05 } },
];

export const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export type Quote = {
  perSeatCents: number; // per seat per month, after the annual discount
  subtotalCents: number;
  volumeCents: number;
  couponCents: number;
  totalCents: number;
};

/** One place for the pricing rules: annual, then volume discount, then coupon, each rounded to the cent. */
export function quote(plan: Plan, seats: number, billing: Billing, couponRate: number): Quote {
  const months = billing === "annual" ? MONTHS_PER_YEAR : 1;
  const perSeatCents = plan.cents * (billing === "annual" ? ANNUAL_FACTOR : 1);
  const subtotalCents = Math.round(perSeatCents * seats * months);
  const volumeCents = plan.volume && seats >= plan.volume.atSeats ? Math.round(subtotalCents * plan.volume.rate) : 0;
  const afterVolume = subtotalCents - volumeCents;
  const couponCents = Math.round(afterVolume * couponRate);
  return { perSeatCents, subtotalCents, volumeCents, couponCents, totalCents: afterVolume - couponCents };
}
