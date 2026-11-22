import { getCheck } from "@/lib/queries";

/** The replay of one check: its steps, screenshots and recording. Null when the run predates replay capture. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCheck((await params).id);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ replay: c.replay, failing: c.status === "failed" });
}
