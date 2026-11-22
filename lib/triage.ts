import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { attributeLine } from "./attribution";
import type { StructuredModel } from "./compile";
import { db } from "./db";

const git = promisify(execFile);

const Answer = z.object({
  file: z.string().describe("Path of the file, exactly as listed"),
  line: z.number().int().describe("Line number of the line where the faulty logic is written, the one a fix would change"),
  line_text: z.string().describe("That line copied exactly"),
  why: z.string().describe("One or two sentences: how this line produces the wrong result on the page"),
});

export type Pick = { file: string; line: number; why: string };

const numbered = (text: string) => text.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n");

/** Trust the model's pointer only if the file was offered and the quoted text really is on that line. */
export function validatePick(a: z.infer<typeof Answer>, files: Map<string, string>): Pick | null {
  const text = files.get(a.file);
  if (!text) return null;
  const lines = text.split("\n");
  const needle = a.line_text.trim();
  if (!needle) return null;
  if (lines[a.line - 1]?.includes(needle)) return { file: a.file, line: a.line, why: a.why };
  // Models are off by a line or two now and then. Snap to the nearest line that holds the quoted text.
  const near = lines.map((l, i) => i + 1).filter((n) => lines[n - 1].includes(needle)).sort((x, y) => Math.abs(x - a.line) - Math.abs(y - a.line))[0];
  return near ? { file: a.file, line: near, why: a.why } : null;
}

const SOURCE = /\.(tsx?|jsx?|css)$/;

/** The code this Trail changed, as numbered text, plus a lookup for validating the answer. */
async function changedSources(dir: string, base: string): Promise<Map<string, string>> {
  const { stdout } = await git("git", ["diff", "--name-only", `${base}...HEAD`], { cwd: dir });
  const out = new Map<string, string>();
  let size = 0;
  for (const f of stdout.split("\n").filter((x) => SOURCE.test(x))) {
    const text = await readFile(path.join(dir, f), "utf8").catch(() => null);
    if (text == null || size + text.length > 60_000) continue;
    size += text.length;
    out.set(f, text);
  }
  return out;
}

/** Entire Graph's ranked, budgeted regions for a plain-language description of the failure. Null when unavailable. */
async function graphContext(dir: string, query: string): Promise<string | null> {
  try {
    const { stdout } = await git("entire", ["graph", "query", "--format", "agent", "--head", "--profile", "full", query], { cwd: dir, maxBuffer: 8 * 1024 * 1024, timeout: 60_000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Finds the line most likely behind a failed check, then the prompt that wrote it (entire why). Best effort: any step
 * that cannot be done leaves the bug report without that level. Works on a throwaway worktree of the Trail's branch so
 * the operator's checkout never matters.
 */
export async function triageCheck(
  checkId: string,
  cfg: { repoDir: string; model: StructuredModel; log?: (m: string) => void },
  opts: { context?: "files" | "graph"; dryRun?: boolean } = {},
) {
  const row = (await db().query(
    `select r.text, c.reason, t.branch, b.id as bug_id from checks c join requirements r on r.id = c.requirement_id
       join runs u on u.id = c.run_id join trails t on t.id = u.trail_id left join bug_reports b on b.check_id = c.id where c.id = $1`, [checkId])).rows[0];
  if (!row?.branch || !row.bug_id) return null;
  const dir = await mkdtemp(path.join(os.tmpdir(), "triage-"));
  try {
    await git("git", ["fetch", "origin", row.branch], { cwd: cfg.repoDir }).catch(() => {});
    await git("git", ["worktree", "add", "--detach", dir, `origin/${row.branch}`], { cwd: cfg.repoDir });
    const files = await changedSources(dir, "origin/main");
    if (!files.size) return null;
    // "files": every changed file, whole. "graph": only the regions Entire Graph ranks for this failure.
    const graph = opts.context !== "files" ? await graphContext(dir, `${row.text}. ${row.reason}`) : null;
    const code = graph ?? [...files].map(([f, t]) => `=== ${f}\n${numbered(t)}`).join("\n\n");
    const prompt = `A browser test of a web app failed. Find the line of code that most likely causes it.

Requirement: ${row.text}
What the tester saw: ${row.reason}

Rules:
- Choose a line from the files below, the one where the faulty logic is written (not a caller, not a type).
- Copy that line exactly into line_text, and give its line number.
- Prefer a real cause over a symptom. Do not guess a file that is not listed.

${graph ? "Code regions ranked as most relevant (file:line shown inline):" : "Code changed by this branch:"}
${code}`;
    const pick = validatePick(Answer.parse(await cfg.model(prompt, Answer)), files);
    if (!pick) return null;
    const a = await attributeLine(pick.file, pick.line, dir).catch(() => null);
    if (opts.dryRun) return { ...pick, attribution: a, contextChars: code.length };
    await db().query(
      "update bug_reports set file=$2, line=$3, cause=$4, commit_sha=$5, checkpoint_id=$6, prompt_session_id=$7, prompt_message_id=$8, prompt_text=$9 where id=$1",
      [row.bug_id, pick.file, pick.line, pick.why, a?.commitSha ?? null, a?.checkpointId ?? null, a?.sessionId ?? null, a?.prompt?.messageId ?? null, a?.prompt?.text ?? a?.fallbackPrompt ?? null],
    );
    cfg.log?.(`triage: ${pick.file}:${pick.line}${a?.prompt ? " (prompt found)" : ""}`);
    return { ...pick, attribution: a, contextChars: code.length };
  } finally {
    await git("git", ["worktree", "remove", "--force", dir], { cwd: cfg.repoDir }).catch(() => {});
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
