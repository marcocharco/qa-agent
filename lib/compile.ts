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
- Write steps as concrete user actions: click, type an exact value, reload, navigate. One action per step.
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

Do exactly the steps above and nothing else. If any step can't be completed exactly as written, or the page differs from what the steps assume, stop and report which step failed. Do not work around problems and do not retry a failed action.
Report only what you actually saw on the page, quoting visible text in "reason". Never assume something passed.
Set failed_step to null if every step passed.`;
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
