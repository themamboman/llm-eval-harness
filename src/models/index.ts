import type { ModelAdapter } from "../types.js";
import { createAnthropicAdapter } from "./anthropic.js";
import { createDeepSeekAdapter } from "./deepseek.js";
import { createOpenAIAdapter } from "./openai.js";

type AdapterFactory = (
  model: string,
  opts?: { temperature?: number }
) => ModelAdapter;

const PROVIDERS: Record<string, AdapterFactory> = {
  anthropic: createAnthropicAdapter,
  openai: createOpenAIAdapter,
  deepseek: createDeepSeekAdapter,
};

/**
 * Resolve a model id to a ModelAdapter.
 *
 * Explicit override: "provider:model" (e.g. "openai:gpt-4o").
 * Otherwise prefix-route: ids starting with "claude" → Anthropic;
 * "gpt" / "o1" / "o3" / "o4" → OpenAI; "deepseek" → DeepSeek.
 * Unrecognized ids throw — never silent-default.
 */
export function createAdapter(
  modelId: string,
  opts?: { temperature?: number }
): ModelAdapter {
  const colon = modelId.indexOf(":");
  if (colon !== -1) {
    const provider = modelId.slice(0, colon).toLowerCase();
    const model = modelId.slice(colon + 1);
    const factory = PROVIDERS[provider];
    if (!factory) {
      throw new Error(
        `Unrecognized provider "${provider}" in "${modelId}". ` +
          `Supported providers: anthropic, openai, deepseek ` +
          `(or use prefix routing: claude*, gpt*/o1*/o3*/o4*, deepseek*).`
      );
    }
    if (!model) {
      throw new Error(
        `Missing model name after provider in "${modelId}". ` +
          `Expected "provider:model" (e.g. "openai:gpt-4o").`
      );
    }
    return factory(model, opts);
  }

  if (modelId.startsWith("claude")) {
    return createAnthropicAdapter(modelId, opts);
  }
  if (
    modelId.startsWith("gpt") ||
    modelId.startsWith("o1") ||
    modelId.startsWith("o3") ||
    modelId.startsWith("o4")
  ) {
    return createOpenAIAdapter(modelId, opts);
  }
  if (modelId.startsWith("deepseek")) {
    return createDeepSeekAdapter(modelId, opts);
  }

  throw new Error(
    `Unrecognized model id "${modelId}". ` +
      `Supported prefixes: claude (Anthropic), gpt/o1/o3/o4 (OpenAI), deepseek (DeepSeek); ` +
      `or use explicit "provider:model" (anthropic|openai|deepseek).`
  );
}
