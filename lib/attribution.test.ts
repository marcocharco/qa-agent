import { describe, expect, it } from "vitest";
import { findPromptForLine } from "./attribution";

const rec = (o: object) => JSON.stringify(o);
const user = (uuid: string, text: string) => rec({ type: "user", uuid, message: { content: text } });
const toolResult = (uuid: string) => rec({ type: "user", uuid, message: { content: [{ type: "tool_result", content: "ok" }] } });
const edit = (uuid: string, file_path: string, new_string: string) =>
  rec({ type: "assistant", uuid, message: { content: [{ type: "tool_use", name: "Edit", input: { file_path, new_string } }] } });

describe("findPromptForLine", () => {
  const log = [
    user("u1", "add the volume tier, 10 or more seats"),
    edit("a1", "/repo/lib/pricing.ts", "if (seats >= volume.over) return 5;"),
    toolResult("t1"),
    user("u2", "pull the numbers into constants, use a strict >"),
    edit("a2", "/repo/lib/pricing.ts", "const x = 1;\nif (seats > volume.over) return 5;"),
    toolResult("t2"),
    user("u3", "run the build"),
    edit("a3", "/repo/lib/pricing.ts", "// context\nif (seats > volume.over) return 5;\n// more"),
  ].join("\n");

  it("blames the prompt that first wrote the line, not later edits that repeat it as context", () => {
    expect(findPromptForLine(log, "lib/pricing.ts", "if (seats > volume.over) return 5;")?.messageId).toBe("u2");
  });
  it("a tool result never counts as the prompt", () => {
    expect(findPromptForLine(log, "lib/pricing.ts", "if (seats >= volume.over) return 5;")?.messageId).toBe("u1");
  });
  it("returns null for another file or a line that was never written", () => {
    expect(findPromptForLine(log, "lib/other.ts", "if (seats > volume.over) return 5;")).toBeNull();
    expect(findPromptForLine(log, "lib/pricing.ts", "never written")).toBeNull();
  });
});
