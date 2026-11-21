import { bugs } from "./bugs";

export type Billing = "monthly" | "annual";

export const ANNUAL_FACTOR = 0.8;
export const COUPONS: Record<string, number> = { SAVE10: 0.1 };

export type Plan = {
  id: "pro" | "team";
  name: string;
  cents: number; // per seat per month
  minSeats: number;
  volume: { atSeats: number; rate: number } | null;
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
export function quote(o: { plan: Plan; seats: number; billing: Billing; couponRate: number }): Quote {
  const { plan, seats, billing, couponRate } = o;
  const months = billing === "annual" ? 12 : 1;
  const perSeatCents = plan.cents * (billing === "annual" ? ANNUAL_FACTOR : 1);
  const subtotalCents = Math.round(perSeatCents * seats * months);

  // BUG volumeDiscountOffByOne: the discount should start AT the threshold, this starts one seat after it.
  const atVolume = plan.volume && (bugs.volumeDiscountOffByOne ? seats > plan.volume.atSeats : seats >= plan.volume.atSeats);
  const volumeCents = atVolume ? Math.round(subtotalCents * plan.volume!.rate) : 0;
  const afterVolume = subtotalCents - volumeCents;

  // BUG couponMissesTeamAnnual: the annual path for Team never passes the coupon through.
  const couponApplies = couponRate > 0 && !(bugs.couponMissesTeamAnnual && plan.id === "team" && billing === "annual");
  // BUG annualCouponWrongBase: in annual mode the coupon is taken off the pre-annual price, so it is too big.
  const couponBase = bugs.annualCouponWrongBase && billing === "annual" ? Math.round(plan.cents * seats * months) - volumeCents : afterVolume;
  const couponCents = couponApplies ? Math.round(couponBase * couponRate) : 0;

  return { perSeatCents, subtotalCents, volumeCents, couponCents, totalCents: afterVolume - couponCents };
}
