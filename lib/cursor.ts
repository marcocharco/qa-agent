import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export type Pt = { x: number; y: number };
const DIR = path.join(process.cwd(), "data", "replays");
const CELL = 8;

/**
 * Where the TinyFish cursor (an orange fish) is in one screenshot, as fractions of its width and height.
 * The browser only returns screenshots, no coordinates, so this looks for the fish: orange-yellow
 * pixels in one tight cluster. The page's own orange is darker and redder, and never forms such a cluster.
 */
export async function findCursor(file: string): Promise<Pt | null> {
  const { data, info } = await sharp(path.join(DIR, file)).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const cw = Math.ceil(w / CELL), chh = Math.ceil(h / CELL);
  const counts = new Uint16Array(cw * chh);
  const hit = (i: number) => data[i] >= 200 && data[i + 1] >= 105 && data[i + 1] <= 200 && data[i + 2] <= 130 && data[i] - data[i + 2] >= 90 && data[i] - data[i + 1] >= 40;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (hit((y * w + x) * ch)) counts[Math.floor(y / CELL) * cw + Math.floor(x / CELL)]++;
  // The densest 6x6 block of cells (48px), about the size of the sprite.
  let best = 0, bx = 0, by = 0;
  for (let cy = 0; cy + 6 <= chh; cy++) for (let cx = 0; cx + 6 <= cw; cx++) {
    let sum = 0;
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) sum += counts[(cy + j) * cw + cx + i];
    if (sum > best) { best = sum; bx = cx; by = cy; }
  }
  if (best < 70) return null;
  let sx = 0, sy = 0, n = 0;
  for (let y = by * CELL; y < Math.min(h, (by + 6) * CELL); y++) for (let x = bx * CELL; x < Math.min(w, (bx + 6) * CELL); x++) if (hit((y * w + x) * ch)) { sx += x; sy += y; n++; }
  return n ? { x: sx / n / w, y: sy / n / h } : null;
}

/** Cursor positions for a list of replay files (paths under data/replays), cached per run folder. */
export async function cursorsFor(files: string[]): Promise<Record<string, Pt | null>> {
  const out: Record<string, Pt | null> = {};
  const byRun = new Map<string, string[]>();
  for (const f of files) byRun.set(f.split("/")[0], [...(byRun.get(f.split("/")[0]) ?? []), f]);
  for (const [run, fs] of byRun) {
    const cacheFile = path.join(DIR, run, "cursors.json");
    const cache: Record<string, Pt | null> = JSON.parse(await readFile(cacheFile, "utf8").catch(() => "{}"));
    let dirty = false;
    for (const f of fs) {
      if (!(f in cache)) { cache[f] = await findCursor(f).catch(() => null); dirty = true; }
      out[f] = cache[f];
    }
    if (dirty) { await mkdir(path.dirname(cacheFile), { recursive: true }); await writeFile(cacheFile, JSON.stringify(cache)); }
  }
  return out;
}
