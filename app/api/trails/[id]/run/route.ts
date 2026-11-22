import { jobStatus, missingEnv, startRun, stopRun } from "@/lib/process";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return Response.json({ running: !!jobStatus((await params).id)?.running });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await stopRun((await params).id);
  return Response.json({ ok: true });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const missing = missingEnv();
  if (missing.length) return Response.json({ error: `Missing environment variables: ${missing.join(", ")}. See .env.example.` }, { status: 500 });
  try {
    await startRun((await params).id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: `Could not start the run: ${String(e).slice(0, 200)}` }, { status: 400 });
  }
}
