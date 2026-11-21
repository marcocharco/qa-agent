import type { Message } from "./extract";

type Part = { type?: string; text?: string };
type TranscriptRecord = { type?: string; uuid?: string; isSidechain?: boolean; isMeta?: boolean; message?: { content?: string | Part[] } };

/** Claude Code JSONL transcript to the user and assistant text messages, keyed by the record uuid. */
export function parseTranscript(jsonl: string): Message[] {
  const out: Message[] = [];
  for (const line of jsonl.split("\n")) {
    let r: TranscriptRecord;
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    if ((r.type !== "user" && r.type !== "assistant") || r.isSidechain || r.isMeta || !r.uuid) continue;
    const c = r.message?.content;
    // Tool results arrive as user records with array content; only text parts are chat.
    const text = typeof c === "string" ? c : Array.isArray(c) ? c.filter((p) => p.type === "text").map((p) => p.text).join("\n") : "";
    if (text.trim()) out.push({ id: r.uuid, role: r.type, text });
  }
  return out;
}
