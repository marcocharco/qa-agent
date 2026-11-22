import { z } from "zod";
import type { StructuredModel } from "./compile";
import { db } from "./db";
import type { Source } from "./extract";

const answer = z.object({
  sources: z.array(z.object({
    id: z.string(),
    /** null when no message in the sources states this requirement */
    sourceId: z.string().nullable(),
    messageId: z.string().nullable(),
    quote: z.string().nullable(),
  })),
});

const PROMPT = `Each requirement below was written by hand. Find where the developer actually asked for it.

For every requirement, return the single message by the developer (role "user") that states it or most directly implies it, with a quote copied word for word from that message (a short phrase or sentence, not a paraphrase). The requirement may add exact numbers worked out from the developer's words; quote the developer's words, not the numbers.
If no developer message asks for it, return null for sourceId, messageId and quote. Never invent a quote.

Requirements (JSON):
`;

/**
 * Hand-written requirements have no source. This finds the chat message behind each one, and keeps it only if the quote
 * really is in that user message, so a citation is never taken on the model's word.
 */
export async function attachSources(trailId: string, sources: Source[], model: StructuredModel): Promise<{ id: string; attached: boolean }[]> {
  const reqs = (await db().query("select id, text from requirements where trail_id = $1 and source_kind = 'manual' and status <> 'rejected'", [trailId])).rows as { id: string; text: string }[];
  if (!reqs.length) return [];
  const raw = await model(PROMPT + JSON.stringify(reqs) + "\n\nSources (JSON):\n" + JSON.stringify(sources), answer);
  const out: { id: string; attached: boolean }[] = [];
  for (const c of answer.parse(raw).sources) {
    const source = sources.find((s) => s.id === c.sourceId);
    const message = source?.messages.find((m) => m.id === c.messageId);
    const ok = !!c.quote && !!source && !!message && message.role === "user" && message.text.includes(c.quote) && reqs.some((r) => r.id === c.id);
    if (ok) {
      await db().query("update requirements set source_kind = $2, source_session_id = $3, source_message_id = $4, quote = $5 where id = $1",
        [c.id, source!.kind, source!.kind === "session" ? source!.id : null, message!.id, c.quote]);
    }
    out.push({ id: c.id, attached: ok });
  }
  return out;
}
