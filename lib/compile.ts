import { z } from "zod";

/** The one boundary to Gemini: prompt + schema in, JSON out. Faked in tests. */
export type StructuredModel = (prompt: string, schema: z.ZodType) => Promise<unknown>;

export type RequirementInput = { id: string; text: string };

export type CheckSpec = {
  preconditions: string[];
  steps: string[];
  expected: string;
};

export type CompileResult =
  | { testable: true; spec: CheckSpec; goal: string }
  | { testable: false; reason: string };

const modelOutput = z.discriminatedUnion("testable", [
  z.object({
    testable: z.literal(true),
    preconditions: z.array(z.string()),
    steps: z.array(z.string()).min(1),
    expected: z.string().min(1),
  }),
  z.object({ testable: z.literal(false), reason: z.string().min(1) }),
]);

export const COMPILER_PROMPT = `You compile one product requirement into a browser test for a QA agent.

Rules:
- Use only what the requirement says. Do not invent features, pages, or data.
- Write steps as user INTENT with exact values ("Set the seat count to 5", "Switch billing to Annual", "Reload the page"). You cannot see the page, so never name a specific control or mechanism (no "type into the field", "click the + button", selectors, or element names) unless the requirement itself names it. The agent will find the right control. One intent per step.
- Use exact values (names, quantities, codes) so every run does the same thing.
- "expected" must be something an observer can SEE on the page (text, count, element state). Never "works correctly".
- If the requirement is subjective ("feels smoother"), needs login/credentials we don't have, or has no observable outcome, return testable=false with a one-sentence reason.
- Preconditions are state the test starts from (for example an empty cart). The agent is given a fresh browser every time.

Requirement:
`;

export function renderGoal(spec: CheckSpec): string {
  const pre = spec.preconditions.length
    ? `Starting state: ${spec.preconditions.join("; ")}.\n\n`
    : "";
  const steps = spec.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `${pre}Test this flow:
${steps}

Expected result: ${spec.expected}

Do exactly the steps above and nothing else. If any step can't be completed exactly as written, or the page differs from what the steps assume, stop and report which step failed. Do not work around problems and do not retry a failed action. If a control is already in the state a step asks for (for example the page already shows Monthly billing), do not click it; just confirm the state.
Report only what you actually saw on the page, quoting visible text in "reason". Never assume something passed.
The expected result is not a step. failed_step must be a step number from 1 to ${spec.steps.length}. Set failed_step to null if every step passed. If all steps could be done but the expected result is not what you saw, report the last step (${spec.steps.length}).`;
}

export async function compileRequirement(
  req: RequirementInput,
  model: StructuredModel,
): Promise<CompileResult> {
  const out = modelOutput.parse(await model(COMPILER_PROMPT + req.text, modelOutput));
  if (!out.testable) return { testable: false, reason: out.reason };
  const spec = { preconditions: out.preconditions, steps: out.steps, expected: out.expected };
  return { testable: true, spec, goal: renderGoal(spec) };
}

/**
 * One goal for one browser session that runs several checks of the same feature in order.
 * The expected values are given as the thing to compare against, but the agent must first quote
 * what it actually sees, so a pass cannot be an echo of the expectation.
 */
export function renderFeatureGoal(specs: CheckSpec[]): string {
  const checks = specs
    .map((spec, i) => {
      const pre = spec.preconditions.length ? `Starting state: ${spec.preconditions.join("; ")}.\n` : "";
      const steps = spec.steps.map((s, j) => `  ${j + 1}. ${s}`).join("\n");
      return `CHECK ${i + 1}\n${pre}Steps:\n${steps}\nExpected: ${spec.expected}`;
    })
    .join("\n\n");
  return `You are testing one feature of a web page in a single browser session. Run the checks below one after another, in order.
Before every check, reload the page so it starts from a fresh state, then do exactly that check's steps and nothing else.

${checks}

Rules:
- If a step can't be completed exactly as written, or the page differs from what the steps assume, stop that check, mark it failed with the step number, and move on to the next check. Do not work around problems and do not retry a failed action.
- If a control is already in the state a step asks for (for example the page already shows Monthly billing), do not click it; just confirm the state.
- For every check, first copy into "observed" the exact visible text of the price lines and labels the check is about, as they appear on the page after the steps (for example the Subtotal, discount and total lines). Copy only what you see. Never copy the Expected text and never fill in a line that is not on the page: if a line is missing, say it is missing.
- Only then compare "observed" with Expected. passed is true only if they match exactly. Do not assume anything passed.
- "check" is the check number. failed_step is a step number inside that check, or null if the check passed. If every step could be done but the page differs from Expected, give the last step of that check.
- Return exactly one result for every check, in order. Never return an empty list: if a check cannot be started or finished for any reason, still return its result with passed set to false, observed set to what you saw instead, and the reason.`;
}
