import { z } from "zod";
import type { StructuredModel } from "./compile";

export type Message = { id: string; role: "user" | "assistant"; text: string };
export type Source = { kind: "description" | "session"; id: string; messages: Message[] };

export type ExtractedRequirement = {
  text: string;
  type: "behaviour" | "validation" | "access" | "visual";
  confidence: number;
  testable: boolean;
  reason: string | null;
  /** Id of an existing requirement this one changes or contradicts, never silently applied. */
  supersedes: string | null;
  sourceKind: Source["kind"];
  sourceId: string;
  messageId: string;
  quote: string;
};

const candidate = z.object({
  text: z.string().min(1),
  type: z.enum(["behaviour", "validation", "access", "visual"]),
  confidence: z.number().min(0).max(1),
  testable: z.boolean(),
  reason: z.string().nullish(),
  sourceId: z.string(),
  messageId: z.string(),
  quote: z.string().min(1),
  supersedes: z.string().nullish(),
});
const output = z.object({ requirements: z.array(candidate) });

export const EXTRACT_PROMPT = `You read what a developer told their coding agent and list the product requirements they stated.

Rules:
- A requirement is something the finished app must do or show. Ignore instructions about code style, tools, or process.
- Only requirements the USER stated or clearly implied count. Never take requirements from the assistant's own messages.
- Each requirement must cite the exact message id and a verbatim quote copied from that message. Do not paraphrase the quote.
- Write "text" as one plain-English sentence a tester could check, with exact values where the user gave them.
- testable=false for subjective asks ("feels smoother") or anything with no observable outcome; give a one-sentence "reason".
- Do not invent requirements. If nothing qualifies, return an empty list.
- If a requirement changes or contradicts one of the "Existing requirements" listed after the sources (for example the user now wants 25% off where an earlier requirement says 20%), set "supersedes" to that existing requirement's id. Otherwise leave it null. Never set it to an id that is not in the list.

Sources (JSON):
`;

export type ExistingRequirement = { id: string; text: string };

export async function extractRequirements(
  sources: Source[],
  model: StructuredModel,
  existing: ExistingRequirement[] = [],
): Promise<ExtractedRequirement[]> {
  const raw = await model(EXTRACT_PROMPT + JSON.stringify(sources) + "\n\nExisting requirements (JSON):\n" + JSON.stringify(existing), output);
  const known = new Set(existing.map((e) => e.id));
  const { requirements } = output.parse(raw);

  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
  const seen = new Set<string>();
  const out: ExtractedRequirement[] = [];
  for (const c of requirements) {
    const source = sources.find((s) => s.id === c.sourceId);
    const message = source?.messages.find((m) => m.id === c.messageId);
    if (!source || !message || message.role !== "user" || !message.text.includes(c.quote)) continue;
    if (seen.has(norm(c.text))) continue;
    seen.add(norm(c.text));
    out.push({
      text: c.text,
      type: c.type,
      confidence: c.confidence,
      testable: c.testable,
      reason: c.reason ?? null,
      supersedes: c.supersedes && known.has(c.supersedes) ? c.supersedes : null,
      sourceKind: source.kind,
      sourceId: source.id,
      messageId: message.id,
      quote: c.quote,
    });
  }
  return out;
}
