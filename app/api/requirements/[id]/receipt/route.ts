import { getRequirementSource } from "@/lib/queries";
import { receiptWindow, type Message } from "@/lib/report";
import { sessionTranscript } from "@/lib/entire";
import { parseTranscript } from "@/lib/transcript";

// Reading a transcript shells out to the Entire CLI, so keep what we have read.
const g = globalThis as unknown as { __receiptsTranscripts?: Map<string, Message[]> };
const cache = (g.__receiptsTranscripts ??= new Map());

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const src = await getRequirementSource((await params).id);
  if (!src) return Response.json({ error: "Not found" }, { status: 404 });
  const base = { kind: src.source_kind, quote: src.quote, messages: [] as ReturnType<typeof receiptWindow>, note: null as string | null, label: "" };

  if (src.source_kind === "manual") return Response.json({ ...base, label: "Added by hand", note: "This requirement was written by a person, so there is no chat message behind it." });
  if (src.source_kind === "description") {
    base.label = `Trail description: ${src.title}`;
    base.messages = receiptWindow([{ id: "description", role: "user", text: `${src.title}\n\n${src.description}` }], "description");
    return Response.json(base);
  }

  base.label = `Session ${src.source_session_id?.slice(0, 8)}`;
  try {
    const sid = src.source_session_id!;
    let messages = cache.get(sid);
    if (!messages) cache.set(sid, (messages = parseTranscript(await sessionTranscript(sid, process.env.TARGET_REPO_DIR!))));
    base.messages = receiptWindow(messages, src.source_message_id ?? "");
    if (!base.messages.length) base.note = "The cited message was not found in the transcript.";
  } catch {
    base.note = "The session transcript could not be read here, so only the quote is shown.";
  }
  return Response.json(base);
}
