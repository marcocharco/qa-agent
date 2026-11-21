import PlanCard, { type PlanView } from "@/components/PlanCard";

// Placeholder content, nothing here is wired up yet.
const PLANS: PlanView[] = [
  {
    name: "Pro",
    blurb: "For small teams getting started.",
    pricePerSeat: "$19.00",
    seats: 1,
    total: "$19.00",
    subtotal: "$19.00",
    features: ["1 to 50 seats", "Email support"],
  },
  {
    name: "Team",
    blurb: "For growing teams that want volume pricing.",
    pricePerSeat: "$29.00",
    seats: 3,
    total: "$87.00",
    subtotal: "$87.00",
    features: ["3 to 50 seats", "5% off at 10 or more seats", "Priority support"],
    featured: true,
  },
];

const on = "rounded-full px-5 py-1.5 text-sm font-medium transition-colors bg-foreground text-background";
const off = "rounded-full px-5 py-1.5 text-sm font-medium transition-colors text-muted hover:text-foreground";

export default function Pricing() {
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
                <button className={on}>Monthly</button>
                <button className={off}>Annual</button>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-5 flex max-w-xs gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-muted"
              placeholder="Coupon code"
            />
            <button className="whitespace-nowrap rounded-full border border-line px-5 py-2 text-sm font-medium transition-colors hover:bg-chip">
              Apply
            </button>
          </div>
          <p className="mt-2 h-5 text-sm text-muted" />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {PLANS.map((p) => (
            <PlanCard key={p.name} plan={p} />
          ))}
        </div>
      </main>
    </>
  );
}
