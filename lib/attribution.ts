import { sessionTranscript } from "./entire";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

type Part = { type?: string; text?: string; name?: string; input?: Record<string, unknown> };
type Rec = { type?: string; uuid?: string; isSidechain?: boolean; isMeta?: boolean; message?: { content?: string | Part[] } };

export type PromptHit = { messageId: string; text: string };

/**
 * The human message that was active when the session first wrote `lineText` into `file`.
 * Walks the transcript in order: remember the latest human message, and at the first Edit, MultiEdit or Write
 * of that file whose new text contains the line, return that message. First, not last, because later edits
 * often repeat the line as unchanged context.
 */
export function findPromptForLine(jsonl: string, file: string, lineText: string): PromptHit | null {
  const needle = lineText.trim();
  if (!needle) return null;
  let current: PromptHit | null = null;
  for (const raw of jsonl.split("\n")) {
    let r: Rec;
    try {
      r = JSON.parse(raw);
    } catch {
      continue;
    }
    if (r.isSidechain || r.isMeta || !r.uuid) continue;
    const c = r.message?.content;
    if (r.type === "user") {
      const text = typeof c === "string" ? c : Array.isArray(c) ? c.filter((p) => p.type === "text").map((p) => p.text).join("\n") : "";
      // Tool results are user records with no text part, so they never replace the current prompt.
      if (text.trim()) current = { messageId: r.uuid, text };
    } else if (r.type === "assistant" && Array.isArray(c) && current) {
      for (const p of c) {
        if (p.type !== "tool_use" || !p.input) continue;
        const path = String(p.input.file_path ?? "");
        if (!path.endsWith(file)) continue;
        const written = [p.input.new_string, p.input.content, ...((p.input.edits as { new_string?: string }[] | undefined) ?? []).map((e) => e.new_string)];
        if (written.some((w) => typeof w === "string" && w.includes(needle))) return current;
      }
    }
  }
  return null;
}

export type Attribution = {
  file: string;
  line: number;
  commitSha: string;
  checkpointId: string;
  sessionId: string;
  /** Null when the transcript has no edit that wrote the line. The session's first prompt is then the fallback. */
  prompt: PromptHit | null;
  fallbackPrompt: string | null;
};

/** `entire why` gives the commit, checkpoint and session behind a line; the transcript gives the exact prompt. */
export async function attributeLine(file: string, line: number, repoDir: string): Promise<Attribution | null> {
  const { stdout } = await run("entire", ["why", `${file}:${line}`, "--json"], { cwd: repoDir, maxBuffer: 20 * 1024 * 1024 });
  const l = JSON.parse(stdout).line as { status: string; commit_sha: string; checkpoint_id?: string; session_id?: string; content?: string; prompt?: string } | undefined;
  if (!l || l.status !== "checkpoint" || !l.session_id || !l.checkpoint_id) return null;
  const jsonl = await sessionTranscript(l.session_id, repoDir);
  return {
    file, line, commitSha: l.commit_sha, checkpointId: l.checkpoint_id, sessionId: l.session_id,
    prompt: findPromptForLine(jsonl, file, l.content ?? ""), fallbackPrompt: l.prompt ?? null,
  };
}
