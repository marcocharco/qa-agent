import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { OpenFindings } from "./findings";

const exec = promisify(execFile);
const entire = async (args: string[]) =>
  (await exec("entire", args, { maxBuffer: 10 * 1024 * 1024 })).stdout;

// Findings have no title or custom fields, so the requirement id rides in the body.
const marker = (requirementId: string) => `[receipts:${requirementId}]`;
const markerRe = /\[receipts:([^\]]+)\]/;

export async function openFindings(): Promise<OpenFindings> {
  const { findings } = JSON.parse(await entire(["trail", "finding", "list", "--json"]));
  const open: OpenFindings = {};
  for (const f of findings as { id: string; body: string; status: string }[]) {
    const m = f.status === "open" && markerRe.exec(f.body ?? "");
    if (m) open[m[1]] = f.id;
  }
  return open;
}

/** Failures are filed as high severity so the Agent Review gate blocks the merge. */
export async function addFinding(requirementId: string, title: string, body: string): Promise<string> {
  const text = `${title}\n\n${body}\n\n${marker(requirementId)}`;
  const out = JSON.parse(await entire(["trail", "finding", "add", "-m", text, "--severity", "high", "--json"]));
  return out.id;
}

export const resolveFinding = (id: string, message: string) =>
  entire(["trail", "finding", "resolve", id, "-m", message]);
