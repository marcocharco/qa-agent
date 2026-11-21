import { geminiModel } from "../lib/gemini";
import { extractRequirements, type Source } from "../lib/extract";
import { compileRequirement } from "../lib/compile";

const session: Source = {
  kind: "session",
  id: "sess-1",
  messages: [
    { id: "m1", role: "user", text: "Build a toy shop with a product grid and add to cart buttons. oh and the cart should survive a refresh." },
    { id: "m2", role: "assistant", text: "Done. I stored the cart in React state." },
    { id: "m3", role: "user", text: "Add a discount code SAVE10 that takes 10% off, it should only work once per order. Also make checkout feel smoother." },
  ],
};

async function main() {
for (const name of process.argv.slice(2)) {
  const model = geminiModel(name);
  const t = Date.now();
  try {
    const reqs = await extractRequirements([session], model);
    console.log(`\n== ${name}: ${reqs.length} reqs in ${Date.now() - t}ms`);
    for (const r of reqs) console.log(` - [${r.testable ? "test" : "SKIP"}] ${r.text} (${r.messageId})`);
    const first = reqs.find((r) => r.testable);
    if (first) {
      const c = await compileRequirement({ id: "x", text: first.text }, model);
      console.log(c.testable ? c.goal : `untestable: ${c.reason}`);
    }
  } catch (e) {
    console.log(`\n== ${name}: ERROR ${(e as Error).message.slice(0, 160)}`);
  }
}
}
main();
