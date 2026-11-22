import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { OpenFindings } from "./findings";

const exec = promisify(execFile);
const entire = async (args: string[], cwd?: string) =>
  (await exec("entire", args, { maxBuffer: 64 * 1024 * 1024, cwd })).stdout;

/** Which Trail a command acts on. Omitted means the Trail of the current branch. */
export type TrailRef = { project: string; trail: string };
const flags = (ref?: TrailRef) => (ref ? ["--project", ref.project, "--trail", ref.trail] : []);

// Findings have no title or custom fields, so the requirement id rides in the body.
const marker = (requirementId: string) => `[archerfish:${requirementId}]`;
const markerRe = /\[archerfish:([^\]]+)\]/;

export async function openFindings(ref?: TrailRef): Promise<OpenFindings> {
  const { findings } = JSON.parse(await entire(["trail", "finding", "list", "--json", ...flags(ref)]));
  const open: OpenFindings = {};
  for (const f of findings as { id: string; body: string; status: string }[]) {
    const m = f.status === "open" && markerRe.exec(f.body ?? "");
    if (m) open[m[1]] = f.id;
  }
  return open;
}

/**
 * A failure of an approved requirement is high severity, so the Agent Review gate blocks the merge. A failure of an
 * unreviewed requirement is low: it informs and blocks nothing until a human approves it (then setSeverity promotes it).
 */
export async function addFinding(requirementId: string, title: string, body: string, ref?: TrailRef, severity: "high" | "low" = "high"): Promise<string> {
  const text = `${title}\n\n${body}\n\n${marker(requirementId)}`;
  const out = JSON.parse(await entire(["trail", "finding", "add", "-m", text, "--severity", severity, "--json", ...flags(ref)]));
  return out.id;
}

export const setSeverity = (findingId: string, severity: "high" | "low", ref?: TrailRef) =>
  entire(["trail", "finding", "update", findingId, "--severity", severity, ...flags(ref)]);

/**
 * The run summary and merge recommendation. A low severity finding sits under the gate threshold, so it informs
 * and never blocks, and it is the sanctioned channel for agent feedback on a Trail (comments are for people).
 * The previous summary is resolved so only the latest is open.
 */
export async function postSummary(text: string, ref?: TrailRef): Promise<void> {
  const open = await openFindings(ref);
  if (open.summary) await resolveFinding(open.summary, "Superseded by a newer run", ref);
  await entire(["trail", "finding", "add", "-m", `ArcherFish summary\n\n${text}\n\n${marker("summary")}`, "--severity", "low", ...flags(ref)]);
}

export const resolveFinding = (id: string, message: string, ref?: TrailRef) =>
  entire(["trail", "finding", "resolve", id, "-m", message, ...flags(ref)]);

export type TrailInfo = {
  id: string;
  number: number;
  title: string;
  body: string;
  status: "open" | "closed";
  /** Branch of the first repository change, where the app code lives. */
  branch: string | null;
  merged: boolean;
};

export async function showTrail(ref: TrailRef): Promise<TrailInfo> {
  const t = JSON.parse(await entire(["trail", "show", ref.trail, "--project", ref.project, "--json"]));
  const changes = (t.changes ?? []) as { branch: string; status: string }[];
  return {
    id: t.id,
    number: t.number,
    title: t.title,
    body: t.body ?? "",
    status: t.status,
    branch: changes[0]?.branch ?? null,
    merged: changes.length > 0 && changes.every((c) => c.status === "merged"),
  };
}

async function allTrailNumbers(project: string): Promise<string[]> {
  const numbers = new Set<string>();
  for (const status of ["open", "closed"]) {
    const { items } = JSON.parse(await entire(["trail", "list", "--project", project, "--status", status, "--json", "-n", "100"]));
    for (const i of items as { number: number }[]) numbers.add(String(i.number));
  }
  return [...numbers];
}

/**
 * Trails whose changes are all merged. A merged change leaves the Trail's own status "open", so we
 * cannot filter on status: list both and check each Trail's changes. Intent-only Trails have no changes.
 */
export async function mergedTrailNumbers(project: string): Promise<string[]> {
  const merged: string[] = [];
  for (const n of await allTrailNumbers(project)) if ((await showTrail({ project, trail: n })).merged) merged.push(n);
  return merged;
}

/** Trails with a branch that is not merged yet: the ones still being worked on. */
export async function activeTrailNumbers(project: string): Promise<string[]> {
  const active: string[] = [];
  for (const n of await allTrailNumbers(project)) {
    const t = await showTrail({ project, trail: n });
    if (t.branch && !t.merged) active.push(n);
  }
  return active;
}

export async function trailSessionIds(ref: TrailRef): Promise<string[]> {
  const { sessions } = JSON.parse(await entire(["trail", "sessions", ref.trail, "--project", ref.project, "--json"]));
  return (sessions as { sessionId: string }[]).map((s) => s.sessionId);
}

/** Raw agent transcript. Sessions are only known inside the clone they were recorded in, hence cwd. */
export const sessionTranscript = (sessionId: string, repoDir: string) =>
  entire(["session", "info", sessionId, "--transcript"], repoDir);
