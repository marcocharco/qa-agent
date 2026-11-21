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
  volume: { over: number; rate: number } | null;
};

export const PLANS: Plan[] = [
  { id: "pro", name: "Pro", cents: 1900, minSeats: 1, volume: null },
  { id: "team", name: "Team", cents: 2900, minSeats: 3, volume: { over: 10, rate: 0.05 } },
];

export const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export type Quote = {
  perSeatCents: number;
  subtotalCents: number;
  volumeCents: number;
  couponCents: number;
  totalCents: number;
};

function volumeDiscount(plan: Plan, seats: number, subtotalCents: number) {
  return plan.volume && seats > plan.volume.over ? Math.round(subtotalCents * plan.volume.rate) : 0;
}

export function monthlyQuote(plan: Plan, seats: number, couponRate: number): Quote {
  const subtotalCents = plan.cents * seats;
  const volumeCents = volumeDiscount(plan, seats, subtotalCents);
  const afterVolume = subtotalCents - volumeCents;
  const couponCents = Math.round(afterVolume * couponRate);
  return { perSeatCents: plan.cents, subtotalCents, volumeCents, couponCents, totalCents: afterVolume - couponCents };
}

export function annualQuote(plan: Plan, seats: number, couponRate: number): Quote {
  const perSeatCents = plan.cents * ANNUAL_FACTOR;
  const subtotalCents = Math.round(perSeatCents * seats * MONTHS_PER_YEAR);

  // plans with a volume tier take the volume discount and return
  if (plan.volume) {
    const volumeCents = volumeDiscount(plan, seats, subtotalCents);
    return { perSeatCents, subtotalCents, volumeCents, couponCents: 0, totalCents: subtotalCents - volumeCents };
  }

  // plans without one go through the coupon and return
  const listCents = plan.cents * seats * MONTHS_PER_YEAR;
  const couponCents = Math.round(listCents * couponRate);
  return { perSeatCents, subtotalCents, volumeCents: 0, couponCents, totalCents: subtotalCents - couponCents };
}
