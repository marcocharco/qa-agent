import type { IconState } from "@/lib/overview";

const label: Record<IconState, string> = {
  running: "Running", passed: "Passed", failed: "Failed", review: "Needs a look", errored: "No verdict", proposed: "To review", todo: "Not run yet",
};

/** One glyph per state so a list can be read at a glance without any text. */
export default function StatusIcon({ state, size = 16 }: { state: IconState; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", role: "img", "aria-label": label[state], className: "shrink-0" } as const;
  switch (state) {
    case "running":
      return (
        <svg {...common} className="shrink-0 animate-spin text-accent"><title>{label[state]}</title>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "passed":
      return (
        <svg {...common} className="shrink-0 text-pass"><title>{label[state]}</title>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M4.8 8.2l2.2 2.2 4.2-4.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "failed":
      return (
        <svg {...common} className="shrink-0 text-fail"><title>{label[state]}</title>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M5.5 5.5l5 5m0-5l-5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "review":
      return (
        <svg {...common} className="shrink-0 text-accent"><title>{label[state]}</title>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M6 4.5v7M6 5h4.2l-1 1.6 1 1.6H6" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "errored":
      return (
        <svg {...common} className="shrink-0 text-muted"><title>{label[state]}</title>
          <path d="M8 2l6.5 11.5h-13z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 6.5v3.2M8 11.4v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "proposed":
      return (
        <svg {...common} className="shrink-0 text-accent"><title>{label[state]}</title>
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.4 2" />
        </svg>
      );
    default:
      return (
        <svg {...common} className="shrink-0 text-muted/60"><title>{label[state]}</title>
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
  }
}
