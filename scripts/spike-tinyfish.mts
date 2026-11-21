import { TinyFish } from "@tiny-fish/sdk";

const client = new TinyFish();
const schema = {
  type: "object",
  properties: {
    passed: { type: "boolean" },
    failed_step: { type: "integer", nullable: true },
    reason: { type: "string" },
  },
  required: ["passed", "failed_step", "reason"],
};
const tail = `\nIf any step can't be completed exactly as written, stop and report which step failed.\nSet failed_step to null if every step passed.`;

async function main() {
  const t = Date.now();
  const run = await client.agent.run({
    url: "https://www.saucedemo.com",
    goal: `Test this flow:
1. Log in with username "standard_user" and password "secret_sauce"
2. Add "Sauce Labs Backpack" to the cart
3. Open the cart

Expected result: the cart page lists exactly 2 items (this is deliberately wrong, the real count is 1)${tail}`,
    agent_config: { mode: "strict", max_steps: 20 },
    output_schema: schema,
  } as never);
  console.log("ms:", Date.now() - t);
  console.log(JSON.stringify(run, null, 2).slice(0, 2500));
}
main();
