import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type FileChange = { path: string; status: string; items: string[] };

type RawFile = { path: string; status: string; changes?: { type: string; kind: string; name: string; dependents_count?: number }[] };

/** "body_changed function Pricing (1 dependent)" as a readable line. */
export function describeChange(c: { type: string; kind: string; name: string; dependents_count?: number }): string {
  const what = c.type.replace(/_/g, " ");
  const n = c.dependents_count ?? 0;
  return `${c.kind} ${c.name}: ${what}${n > 0 ? ` (${n} ${n === 1 ? "dependent" : "dependents"})` : ""}`;
}

/** What changed between two refs, by code entity, from Entire Graph. Empty when the graph is unavailable. */
export async function graphDiff(repoDir: string, base: string, head: string): Promise<FileChange[]> {
  try {
    const { stdout } = await run("entire", ["graph", "diff", "--base", base, "--head", head, "--json"], { cwd: repoDir, maxBuffer: 32 * 1024 * 1024, timeout: 60_000 });
    const files = (JSON.parse(stdout).files ?? []) as RawFile[];
    return files.map((f) => ({ path: f.path, status: f.status, items: (f.changes ?? []).map(describeChange) }));
  } catch {
    return [];
  }
}
