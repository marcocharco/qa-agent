// Turns the agent's raw step list into the few logical steps a person wants to read. Pure, so it is easy to test.
export type Frame = { action: string; durationS: number | null; file: string | null };
export type Group = { label: string; /** Only the agent reading the page */ look: boolean; frames: Frame[]; durationS: number | null; /** The frame to show: the last one with a screenshot */ file: string | null };

/** Drops the agent's own bookkeeping ("for Check 2", "CHECK 1 step 3:"). */
export const cleanAction = (a: string) => a.replace(/^check \d+( step \d+)?:\s*/i, "").replace(/\s*\(?for check \d+\)?/gi, "").replace(/\s*\bcheck \d+\b/gi, "").replace(/\s{2,}/g, " ").trim();

// Reading the page, not doing anything: several in a row are one "look".
const LOOK = /^(check|visual check|understand|confirm|recheck|re-check|get|full page|find how|read|verify|look|inspect|take)\b/i;
// The agent wrapping up, not a user action.
const NOISE = /^(finish|finished|complete|completed|report|task|return|done|submit)\b/i;
const isLook = (a: string) => LOOK.test(a);
/** Same action, different numbers: "Increase seats to 4", "Increase seats to 5". */
const shape = (a: string) => a.replace(/\bfrom \d+ /i, "").replace(/\d+/g, "#");

function labelOf(frames: Frame[]): string {
  const first = cleanAction(frames[0].action);
  const last = cleanAction(frames[frames.length - 1].action);
  if (frames.length === 1) return last;
  if (isLook(first)) return last;
  const to = last.match(/(\d+)\D*$/)?.[1];
  if (to && /\bfrom \d+ to \d+/i.test(first) && shape(first) === shape(last)) return first.replace(/(\bfrom \d+ to )\d+/i, `$1${to}`);
  return shape(first) === shape(last) && /\d/.test(last) ? `${last} (×${frames.length})` : last;
}

export function collapseSteps(all: Frame[]): Group[] {
  const frames = all.filter((f, i) => !NOISE.test(cleanAction(f.action)) || i === 0);
  const out: Frame[][] = [];
  for (const f of frames) {
    const prev = out[out.length - 1]?.at(-1);
    const a = cleanAction(f.action);
    if (prev && ((isLook(a) && isLook(cleanAction(prev.action))) || shape(a) === shape(cleanAction(prev.action)))) out[out.length - 1].push(f);
    else out.push([f]);
  }
  const groups = out.map((fs) => {
    const look = isLook(cleanAction(fs[0].action));
    return {
      label: labelOf(fs),
      look,
      frames: fs,
      durationS: fs.some((f) => f.durationS != null) ? Math.round(fs.reduce((s, f) => s + (f.durationS ?? 0), 0) * 10) / 10 : null,
      file: [...fs].reverse().find((f) => f.file)?.file ?? null,
    };
  });
  // The agent looking at the page is not something a person needs to repeat. The last look stays: it is the evidence frame.
  return groups.filter((g, i) => !g.look || i === groups.length - 1).map((g) => (g.look ? { ...g, label: "Read the result" } : g));
}
