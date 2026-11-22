import { describe, expect, it } from "vitest";
import { validatePick } from "./triage";

const files = new Map([["lib/p.ts", "a\nif (seats > volume.over) {\nreturn 1\n}"]]);
const ans = (o: object) => ({ file: "lib/p.ts", line: 2, line_text: "seats > volume.over", why: "w", ...o });

describe("validatePick", () => {
  it("accepts a line that holds the quoted text", () => expect(validatePick(ans({}), files)).toEqual({ file: "lib/p.ts", line: 2, why: "w" }));
  it("snaps an off-by-one line number", () => expect(validatePick(ans({ line: 3 }), files)?.line).toBe(2));
  it("rejects a file that was not offered", () => expect(validatePick(ans({ file: "x.ts" }), files)).toBeNull());
  it("rejects text that is nowhere in the file", () => expect(validatePick(ans({ line_text: "nothing" }), files)).toBeNull());
});
