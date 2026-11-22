import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://agent.tinyfish.ai";
/** Where replays live on disk. The dashboard serves them from here, so scripts and the app must share the repo root as cwd. */
export const REPLAY_DIR = path.join(process.cwd(), "data", "replays");

export type ReplayStep = { id: string; at: string; action: string; durationS: number | null; file: string | null };
export type Replay = { runId: string; steps: ReplayStep[]; video: string | null };

type ApiStep = { id: string; timestamp: string; action: string; duration?: string | null; screenshot?: string | null };

const key = () => process.env.TINYFISH_API_KEY ?? (() => { throw new Error("TINYFISH_API_KEY is not set"); })();
const get = (url: string) => fetch(url, { headers: { "X-API-Key": key() } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Download a finished run's screenshots and recording now. The video link is presigned and expires, and the
 * SDK's run object hides steps and video_url, so this calls the REST endpoint directly. Never throws on a
 * missing piece: a replay with some frames is better than none.
 */
export async function saveReplay(runId: string): Promise<Replay> {
  let run: { steps?: ApiStep[]; video_url?: string | null } = {};
  // The video and steps can land a moment after COMPLETE, so look a few times.
  for (let i = 0; i < 6; i++) {
    const res = await get(`${BASE}/v1/runs/${runId}`);
    if (res.ok) run = await res.json();
    if (run.steps?.length && run.video_url) break;
    await sleep(3000);
  }
  const dir = path.join(REPLAY_DIR, runId);
  await mkdir(dir, { recursive: true });

  const steps = run.steps ?? [];
  const out: ReplayStep[] = steps.map((s) => ({
    id: s.id,
    at: s.timestamp,
    action: s.action,
    durationS: s.duration ? Number.parseFloat(s.duration) : null,
    file: null as string | null,
  }));
  const queue = out.map((_, i) => i);
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
        try {
          const res = await get(`${BASE}/v1/runs/${runId}/steps/${out[i].id}/screenshot`);
          if (!res.ok) continue;
          const name = `${String(i + 1).padStart(2, "0")}.jpg`;
          await writeFile(path.join(dir, name), Buffer.from(await res.arrayBuffer()));
          out[i].file = `${runId}/${name}`;
        } catch { /* a missing frame must not lose the rest */ }
      }
    }),
  );

  let video: string | null = null;
  if (run.video_url) {
    try {
      const res = await fetch(run.video_url);
      if (res.ok) {
        await writeFile(path.join(dir, "video.mp4"), Buffer.from(await res.arrayBuffer()));
        video = `${runId}/video.mp4`;
      }
    } catch { /* no video is fine, the filmstrip still plays */ }
  }
  return { runId, steps: out, video };
}

/**
 * One browser session runs several checks and labels its steps "... for Check 2". Returns the inclusive step
 * range of check `pos` (1-based), so a bug report can show only its own steps. Falls back to the whole session.
 * The last step of the range is the frame to show as "where it failed".
 */
export function segmentSteps(actions: string[], pos: number): { start: number; end: number } {
  const n = actions.map((a) => Number(/check\s*(\d+)/i.exec(a)?.[1] ?? 0));
  const end = n.lastIndexOf(pos);
  if (end < 0) return { start: 0, end: Math.max(0, actions.length - 1) };
  // The agent sometimes redoes a check after another one. Take the last contiguous block, walking back over this
  // check's labeled steps and the unlabeled ones between them, and stop at a step labeled for another check.
  let start = end;
  while (start > 0 && (n[start - 1] === pos || n[start - 1] === 0)) start--;
  return { start, end };
}
