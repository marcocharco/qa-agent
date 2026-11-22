import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { REPLAY_DIR } from "@/lib/replay";

const types: Record<string, string> = { ".jpg": "image/jpeg", ".mp4": "video/mp4" };

/** Serves downloaded run screenshots and recordings. Range requests are supported so the video can seek. */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const file = path.join(REPLAY_DIR, ...(await params).path);
  // Never leave the replay folder, whatever the URL says.
  if (!file.startsWith(REPLAY_DIR + path.sep) || !types[path.extname(file)]) return new Response("Not found", { status: 404 });
  try {
    const size = (await stat(file)).size;
    const buf = await readFile(file);
    const headers = { "Content-Type": types[path.extname(file)], "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      return new Response(buf.subarray(start, end + 1), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
    }
    return new Response(buf, { headers: { ...headers, "Content-Length": String(size) } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
