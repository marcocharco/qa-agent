import { describe, expect, it } from "vitest";
import { extractRequirements, type Source } from "./extract";
import type { StructuredModel } from "./compile";

const session: Source = {
  kind: "session",
  id: "sess-1",
  messages: [
    { id: "m1", role: "user", text: "Build a shop page. oh and the cart should survive a refresh." },
    { id: "m2", role: "assistant", text: "Sure, I will persist the cart in localStorage." },
  ],
};

const fake = (candidates: unknown[]): StructuredModel => async () => ({ requirements: candidates });

describe("extractRequirements", () => {
  it("keeps the source message and quote with each requirement", async () => {
    const model = fake([
      {
        text: "The cart survives a page refresh",
        type: "behaviour",
        confidence: 0.9,
        testable: true,
        sourceId: "sess-1",
        messageId: "m1",
        quote: "the cart should survive a refresh",
      },
    ]);

    const out = await extractRequirements([session], model);

    expect(out).toEqual([
      {
        text: "The cart survives a page refresh",
        type: "behaviour",
        confidence: 0.9,
        testable: true,
        reason: null,
        sourceKind: "session",
        sourceId: "sess-1",
        messageId: "m1",
        quote: "the cart should survive a refresh",
      },
    ]);
  });

  it("drops a requirement whose quote is not in the cited message", async () => {
    const model = fake([
      {
        text: "Checkout sends a confirmation email",
        type: "behaviour",
        confidence: 0.8,
        testable: true,
        sourceId: "sess-1",
        messageId: "m1",
        quote: "send a confirmation email",
      },
    ]);

    expect(await extractRequirements([session], model)).toEqual([]);
  });

  it("ignores requirements cited from the assistant's own messages", async () => {
    const model = fake([
      {
        text: "Cart persists in localStorage",
        type: "behaviour",
        confidence: 0.7,
        testable: true,
        sourceId: "sess-1",
        messageId: "m2",
        quote: "persist the cart in localStorage",
      },
    ]);

    expect(await extractRequirements([session], model)).toEqual([]);
  });

  it("merges duplicates and keeps the untestable reason", async () => {
    const dup = {
      text: "The cart survives a page refresh",
      type: "behaviour",
      confidence: 0.9,
      testable: true,
      sourceId: "sess-1",
      messageId: "m1",
      quote: "the cart should survive a refresh",
    };
    const vague = {
      text: "Shop feels fast",
      type: "behaviour",
      confidence: 0.4,
      testable: false,
      reason: "No observable outcome",
      sourceId: "sess-1",
      messageId: "m1",
      quote: "Build a shop page",
    };

    const out = await extractRequirements(
      [session],
      fake([dup, { ...dup, text: "the cart survives a page refresh " }, vague]),
    );

    expect(out.map((r) => r.text)).toEqual(["The cart survives a page refresh", "Shop feels fast"]);
    expect(out[1].reason).toBe("No observable outcome");
  });
});
