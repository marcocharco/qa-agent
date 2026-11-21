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
const marker = (requirementId: string) => `[receipts:${requirementId}]`;
const markerRe = /\[receipts:([^\]]+)\]/;

export async function openFindings(ref?: TrailRef): Promise<OpenFindings> {
  const { findings } = JSON.parse(await entire(["trail", "finding", "list", "--json", ...flags(ref)]));
  const open: OpenFindings = {};
  for (const f of findings as { id: string; body: string; status: string }[]) {
    const m = f.status === "open" && markerRe.exec(f.body ?? "");
    if (m) open[m[1]] = f.id;
  }
  return open;
}

/** Failures are filed as high severity so the Agent Review gate blocks the merge. */
export async function addFinding(requirementId: string, title: string, body: string, ref?: TrailRef): Promise<string> {
  const text = `${title}\n\n${body}\n\n${marker(requirementId)}`;
  const out = JSON.parse(await entire(["trail", "finding", "add", "-m", text, "--severity", "high", "--json", ...flags(ref)]));
  return out.id;
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

export async function closedTrailNumbers(project: string): Promise<string[]> {
  const { items } = JSON.parse(await entire(["trail", "list", "--project", project, "--status", "closed", "--json", "-n", "100"]));
  return (items as { number: number }[]).map((i) => String(i.number));
}

export async function trailSessionIds(ref: TrailRef): Promise<string[]> {
  const { sessions } = JSON.parse(await entire(["trail", "sessions", ref.trail, "--project", ref.project, "--json"]));
  return (sessions as { sessionId: string }[]).map((s) => s.sessionId);
}

/** Raw agent transcript. Sessions are only known inside the clone they were recorded in, hence cwd. */
export const sessionTranscript = (sessionId: string, repoDir: string) =>
  entire(["session", "info", sessionId, "--transcript"], repoDir);
