import Anthropic from "@anthropic-ai/sdk";
import type { CompletionResult, ModelAdapter } from "../types.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// USD per 1,000,000 tokens. These are placeholders — verify against current
// Anthropic pricing before trusting the cost column.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-opus-4-1": { input: 15, output: 75 },
  "claude-haiku-3-5": { input: 0.8, output: 4 },
};

export function createAnthropicAdapter(model: string): ModelAdapter {
  return {
    name: model,
    async complete(prompt: string): Promise<CompletionResult> {
      const start = Date.now();

      const resp = await client.messages.create({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

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
