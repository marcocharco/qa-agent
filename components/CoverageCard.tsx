import type { Coverage } from "@/lib/queries";

/** Which stated asks have a test, which have not run yet, and which cannot be tested at all. */
export default function CoverageCard({ c }: { c: Coverage }) {
  if (!c.asks) return null;
  const tested = c.live - c.neverRun.length;
  return (
    <div className="mt-6 rounded-xl border border-line px-5 py-4">
      <p className="text-sm">
        <span className="font-medium">Coverage.</span> {c.asks} {c.asks === 1 ? "ask" : "asks"} from the chat: {tested} tested, {c.neverRun.length} not run yet, {c.untestable.length} cannot be tested.
      </p>
      {(c.neverRun.length > 0 || c.untestable.length > 0) && (
        <details className="mt-2 text-sm text-muted">
          <summary className="cursor-pointer">Show gaps</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {c.neverRun.map((t) => <li key={t}>Not run yet: {t}</li>)}
            {c.untestable.map((u) => <li key={u.text}>Cannot be tested: {u.text} ({u.reason})</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
