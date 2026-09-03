import Anthropic from "@anthropic-ai/sdk";
import type { CompletionResult, ModelAdapter } from "../types.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30000,
  maxRetries: 0,
});

// Models discovered at runtime to reject the temperature parameter.
const temperatureRejectedModels = new Set<string>();

// USD per 1,000,000 tokens. These are placeholders — verify against current
// Anthropic pricing before trusting the cost column.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-opus-4-1": { input: 15, output: 75 },
  "claude-haiku-3-5": { input: 0.8, output: 4 },
};

function isTemperatureRejectedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; statusCode?: number; message?: string };
  const status = e.status ?? e.statusCode;
  const message = typeof e.message === "string" ? e.message : String(err);
  return status === 400 && /temperature/i.test(message);
}

export function createAnthropicAdapter(
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
        resp = await client.messages.create(params);
      } catch (err) {
        if (!includeTemperature || !isTemperatureRejectedError(err)) {
          throw err;
        }
        temperatureRejectedModels.add(model);
        console.warn(
          `model ${model} does not accept temperature; running at provider default (results may not be reproducible for this model)`
        );
        start = Date.now();
        resp = await client.messages.create(baseParams);
      }

      const latencyMs = Date.now() - start;

      const output = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      const { input_tokens, output_tokens } = resp.usage;
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
