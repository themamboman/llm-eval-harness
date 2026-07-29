import type { JudgeVerdict, ModelAdapter } from "./types.js";
import { JudgeVerdictSchema } from "./types.js";

function buildJudgePrompt(
  output: string,
  conceptualRequired: string[],
  presentDisqualifiers: string[]
): string {
  const requiredLines =
    conceptualRequired.length > 0
      ? conceptualRequired
          .map(
            (c, i) =>
              `${i + 1}. REQUIRED (conceptual): "${c}" — Is this idea clearly expressed in the answer, regardless of exact wording?`
          )
          .join("\n")
      : "(none)";

  const disqualifierLines =
    presentDisqualifiers.length > 0
      ? presentDisqualifiers
          .map(
            (d, i) =>
              `${i + 1}. DISQUALIFIER: "${d}" — Does the answer RECOMMEND, ENDORSE, or USE this anti-pattern? Mere mention to warn against or exclude it does NOT count.`
          )
          .join("\n")
      : "(none)";

  return `You are an evaluation judge. Read the model answer and answer each criterion below.

MODEL ANSWER:
---
${output}
---

CRITERIA TO JUDGE:

${requiredLines}

${disqualifierLines}

For each criterion listed above, output one verdict object:
- criterion: the exact criterion text (in quotes above)
- kind: "required" for conceptual required items, "disqualifier" for disqualifier items
- met: for REQUIRED — true if the idea is expressed; for DISQUALIFIER — true ONLY if the anti-pattern is endorsed/recommended/used (false if only mentioned as something to avoid)
- reason: one brief sentence

Respond with STRICT JSON ONLY: a JSON array of objects. No markdown fences, no prose before or after.

Example shape:
[{"criterion":"...","kind":"required","met":true,"reason":"..."}]`;
}

function parseJudgeResponse(text: string): JudgeVerdict[] {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Judge returned invalid JSON: ${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Judge response must be a JSON array of verdict objects");
  }

  const verdicts: JudgeVerdict[] = [];
  for (const entry of parsed) {
    const result = JudgeVerdictSchema.safeParse(entry);
    if (!result.success) {
      throw new Error(
        `Judge verdict failed validation: ${result.error.message}`
      );
    }
    verdicts.push(result.data);
  }

  return verdicts;
}

/**
 * Batch-judge conceptual required criteria and present disqualifiers in one call.
 */
export async function judgeCase(
  adapter: ModelAdapter,
  output: string,
  conceptualRequired: string[],
  presentDisqualifiers: string[]
): Promise<JudgeVerdict[]> {
  const prompt = buildJudgePrompt(
    output,
    conceptualRequired,
    presentDisqualifiers
  );
  const completion = await adapter.complete(prompt);
  return parseJudgeResponse(completion.output);
}
