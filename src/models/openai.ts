import OpenAI from "openai";
import type { CompletionResult, ModelAdapter } from "../types.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
  maxRetries: 0,
});

// Models discovered at runtime to reject the temperature parameter.
const temperatureRejectedModels = new Set<string>();

// USD per 1,000,000 tokens. PLACEHOLDERS — verify against current OpenAI
// pricing before trusting the cost column. Unknown models fall back to 0.
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0, output: 0 },
  "gpt-4o-mini": { input: 0, output: 0 },
  "o1": { input: 0, output: 0 },
  "o3": { input: 0, output: 0 },
};

function isTemperatureRejectedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; statusCode?: number; message?: string };
  const status = e.status ?? e.statusCode;
  const message = typeof e.message === "string" ? e.message : String(err);
  return status === 400 && /temperature/i.test(message);
}

export function createOpenAIAdapter(
  model: string,
  options?: { temperature?: number }
): ModelAdapter {
  return {
    name: model,
    async complete(prompt: string): Promise<CompletionResult> {
      const includeTemperature =
        options?.temperature !== undefined &&
        !temperatureRejectedModels.has(model);

      const baseParams = {
        model,
        max_tokens: 1024,
        messages: [{ role: "user" as const, content: prompt }],
      };
      const params = includeTemperature
        ? { ...baseParams, temperature: options!.temperature }
        : baseParams;

      let start = Date.now();
      let resp;
      try {
        resp = await client.chat.completions.create(params);
      } catch (err) {
        if (!includeTemperature || !isTemperatureRejectedError(err)) {
          throw err;
        }
        temperatureRejectedModels.add(model);
        console.warn(
          `model ${model} does not accept temperature; running at provider default (results may not be reproducible for this model)`
        );
        start = Date.now();
        resp = await client.chat.completions.create(baseParams);
      }

      const latencyMs = Date.now() - start;

      const output = resp.choices[0]?.message?.content ?? "";
      const input_tokens = resp.usage?.prompt_tokens ?? 0;
      const output_tokens = resp.usage?.completion_tokens ?? 0;
      const price = PRICING[model] ?? { input: 0, output: 0 };
      const costUsd =
        (input_tokens / 1_000_000) * price.input +
        (output_tokens / 1_000_000) * price.output;

      return {
        output,
        tokensUsed: input_tokens + output_tokens,
        latencyMs,
        costUsd,
      };
    },
  };
}
