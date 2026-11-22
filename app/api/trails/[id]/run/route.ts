import { missingEnv, startRun } from "@/lib/process";

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
