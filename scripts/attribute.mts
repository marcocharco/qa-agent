// Usage: npx tsx --env-file=.env.local scripts/attribute.mts <file:line>
// Prints the commit, checkpoint, session and exact prompt behind a line of the target repo.
import { attributeLine } from "../lib/attribution";

const [file, line] = (process.argv[2] ?? "").split(":");
if (!file || !line) throw new Error("usage: attribute.mts <file:line>");
const a = await attributeLine(file, Number(line), process.env.TARGET_REPO_DIR!);
console.log(a ? { ...a, prompt: a.prompt ? { messageId: a.prompt.messageId, text: a.prompt.text.slice(0, 200) } : null, fallbackPrompt: a.fallbackPrompt?.slice(0, 80) } : "no checkpoint for this line");
