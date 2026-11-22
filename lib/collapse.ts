// Turns the agent's raw step list into the few logical steps a person wants to read. Pure, so it is easy to test.
export type Frame = { action: string; durationS: number | null; file: string | null };
export type Pt = { x: number; y: number };
export type Group = { label: string; /** Only the agent reading the page */ look: boolean; frames: Frame[]; durationS: number | null; /** The frame to show: the last one with a screenshot */ file: string | null };

/** Drops the agent's own bookkeeping ("for Check 2", "CHECK 1 step 3:"). */
export const cleanAction = (a: string) => a.replace(/^check \d+( step \d+)?:\s*/i, "").replace(/\s*\(?for check \d+\)?/gi, "").replace(/\s*\bcheck \d+\b/gi, "").replace(/\s*\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim();

// Reading the page, not doing anything: several in a row are one "look".
const LOOK = /^(check|visual check|understand|confirm|recheck|re-check|get|full page|find how|read|verify|look|inspect|take)\b/i;
// The agent wrapping up, not a user action.
const NOISE = /^(finish|finished|complete|completed|report|task|return|done|submit)\b/i;
const SETUP = /^(reload|navigate|refresh|open|go to|visit)\b/i;
const isLook = (a: string) => LOOK.test(a);
/** The agent clicking, pressing or typing: something a person would have to do. */
export const CLICK = /\b(click|press|tap|select|increase|decrease|set|apply|switch|toggle|choose|submit|add|remove|enter|type|input|fill)\b/i;
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

/**
 * With the cursor positions of each screenshot, a step only counts if a person would have to do something: the cursor
 * moved, or the agent clicked or typed. Anything else (reading, extracting, checking) is not a step. Its screenshot is kept
 * as the picture of the step before it, so the page as it ended up is still what that step shows.
 */
export function collapseSteps(all: Frame[], cursors?: Record<string, Pt | null>): Group[] {
  const moved = (i: number) => {
    const a = cursors?.[all[i - 1]?.file ?? ""], b = cursors?.[all[i]?.file ?? ""];
    return !!a && !!b && Math.hypot(a.x - b.x, a.y - b.y) > 0.004;
  };
  const extra = new Map<Frame, Frame[]>();
  const frames: Frame[] = [];
  all.forEach((f, i) => {
    const a = cleanAction(f.action);
    if (NOISE.test(a) && i !== 0) return;
    // The first reload or navigation is "Open the page". After that, a step needs the cursor to move, or a click or typing.
    const interactive = !cursors || (SETUP.test(a) ? !frames.some((x) => SETUP.test(cleanAction(x.action))) : !isLook(a) && (CLICK.test(a) || moved(i)));
    if (interactive || (!cursors && !frames.length)) frames.push(f);
    else if (frames.length && !SETUP.test(a)) extra.set(frames[frames.length - 1], [...(extra.get(frames[frames.length - 1]) ?? []), f]);
  });
  if (!frames.length && all.length) frames.push(all[all.length - 1]);
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
      durationS: fs.some((f) => f.durationS != null) ? Math.round(fs.flatMap((f) => [f, ...(extra.get(f) ?? [])]).reduce((s, f) => s + (f.durationS ?? 0), 0) * 10) / 10 : null,
      file: [...fs.flatMap((f) => [f, ...(extra.get(f) ?? [])])].reverse().find((f) => f.file)?.file ?? null,
    };
  });
  // The agent looking at the page is not something a person needs to repeat. The last look stays: it is the evidence frame.
  // A reload or navigation after the last read belongs to whatever the agent did next, not to this check.
  const lastLook = groups.map((g) => g.look).lastIndexOf(true);
  const kept = lastLook >= 0 ? groups.filter((g, i) => i <= lastLook || !SETUP.test(cleanAction(g.frames[0].action))) : groups;
  // Reloads and navigation are the agent resetting its page, not steps. Only the first one stays, as "Open the page".
  const setup = (g: (typeof kept)[number]) => SETUP.test(cleanAction(g.frames[0].action));
  const first = kept.findIndex(setup);
  const steps = kept.filter((g, i) => !setup(g) || i === first);
  // Looks in the middle are dropped; the last one is the evidence frame.
  return steps
    .filter((g, i) => !g.look || i === steps.length - 1)
    .map((g, i) => (g.look ? { ...g, label: "Read the result" } : setup(g) && i === 0 ? { ...g, label: "Open the page" } : g));
}
