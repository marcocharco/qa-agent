export type PlanView = {
  name: string;
  blurb: string;
  pricePerSeat: string;
  seats: number;
  total: string;
  subtotal: string;
  features: string[];
  featured?: boolean;
};

const muted = "text-sm text-muted";
const step =
  "flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg transition-colors hover:bg-chip";

export default function PlanCard({ plan }: { plan: PlanView }) {
  return (
    <div className={`relative flex flex-col rounded-xl border bg-panel p-7 ${plan.featured ? "border-accent" : "border-line"}`}>
      {plan.featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-background">
          Most popular
        </span>
      )}

      <h2 className="text-xl font-semibold">{plan.name}</h2>
      <p className={`mt-1 ${muted}`}>{plan.blurb}</p>

      <p className="mt-6">
        <span className={muted}>Price per seat: </span>
        <span className="text-2xl font-semibold tabular-nums">{plan.pricePerSeat}</span>
        <span className={muted}> per month</span>
      </p>

      <div className="mt-6 flex items-center justify-between border-t border-line pt-6">
        <span className={muted}>{plan.name} seats</span>
        <div className="flex items-center gap-3">
          <button aria-label={`Decrease ${plan.name} seats`} className={step}>
            −
          </button>
          <span aria-label={`${plan.name} seat count`} className="min-w-8 text-center text-2xl font-semibold tabular-nums">
            {plan.seats}
          </span>
          <button aria-label={`Increase ${plan.name} seats`} className={step}>
            +
          </button>
        </div>
      </div>

      <div className="mt-6">
        <p>
          <span className={muted}>Total: </span>
          <span className="text-4xl font-semibold tracking-tight tabular-nums">{plan.total}</span>
          <span className={muted}> per month</span>
        </p>
        <div className={`mt-4 space-y-1 ${muted}`}>
          <p>Subtotal: {plan.subtotal}</p>
        </div>
      </div>

      <ul className="my-6 space-y-2 border-t border-line pt-6 text-sm">
        {plan.features.map((f) => (
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
