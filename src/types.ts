import { z } from "zod";

// ── Zod Schemas (runtime validation) ─────────────────────────────────────────

export const RubricCriterionItemSchema = z.union([
  z.string(),
  z.object({
    text: z.string(),
    type: z.enum(["literal", "conceptual"]).optional(),
  }),
]);

export const RubricSchema = z.object({
  required: z.array(RubricCriterionItemSchema),
  disqualifiers: z.array(RubricCriterionItemSchema),
  scoring: z.enum(["binary", "rubric"]),
});

export const JudgeVerdictSchema = z.object({
  criterion: z.string(),
  kind: z.enum(["required", "disqualifier"]),
  met: z.boolean(),
  reason: z.string(),
});

export const ScoringRawSchema = z.object({
  outputLength: z.number(),
  hitRate: z.number(),
  judgeVerdicts: z.array(JudgeVerdictSchema).optional(),
});

export const EvalCaseSchema = z.object({
  id: z.string(),
  category: z.enum(["policy", "edge-case", "concepts", "design"]),
  difficulty: z.enum(["basic", "intermediate", "advanced"]),
  question: z.string(),
  rubric: RubricSchema,
  notes: z.string().optional(),
});

export const RunReportSchema = z.object({
  runId: z.string(),
  datasetName: z.string(),
  timestamp: z.string(),
  models: z.array(z.string()),
  summaries: z.array(
    z.object({
      model: z.string(),
      totalCases: z.number(),
      passCount: z.number(),
      partialCount: z.number(),
      failCount: z.number(),
      passRate: z.number(),
      avgQualityScore: z.number(),
      totalTokens: z.number(),
      totalCostUsd: z.number(),
      avgLatencyMs: z.number(),
      failureModeCounts: z.object({
        silent: z.number(),
        fluent_error: z.number(),
        spec_drift: z.number(),
        hallucination: z.number(),
      }),
      byCategory: z.record(
        z.object({
          pass: z.number(),
          partial: z.number(),
          fail: z.number(),
        })
      ),
    })
  ),
  results: z.array(
    z.object({
      model: z.string(),
      caseId: z.string(),
      category: z.string(),
      output: z.string(),
      tokensUsed: z.number(),
      latencyMs: z.number(),
      costUsd: z.number(),
      score: z.enum(["pass", "partial", "fail"]),
      failureMode: z
        .enum(["silent", "fluent_error", "spec_drift", "hallucination"])
        .nullable(),
      qualityScore: z.number(),
      requiredHits: z.array(z.string()),
      requiredMisses: z.array(z.string()),
      disqualifierHits: z.array(z.string()),
      confidence: z.enum(["high", "low"]),
      raw: ScoringRawSchema,
    })
  ),
});

// ── Inferred Types ────────────────────────────────────────────────────────────

export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type Rubric = z.infer<typeof RubricSchema>;
export type RubricCriterionItem = z.infer<typeof RubricCriterionItemSchema>;
export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

export interface RubricCriterion {
  text: string;
  type: "literal" | "conceptual";
}

/**
 * Infer routing for a bare required criterion.
 *
 * "literal" is narrow and earned — only genuine code/API tokens:
 * symbols (: _ * / .) or internal camelCase/PascalCase.
 * Everything else (plain words, hyphenated prose like "read-only") is
 * "conceptual". Prefer conceptual when ambiguous: the judge subsumes
 * substring matching, so over-routing costs a small judge call, while
 * under-routing to literal causes false-fails on paraphrase.
 * Explicit { text, type } tags always override this heuristic.
 */
export function inferRequiredType(text: string): "literal" | "conceptual" {
  if (/[:_*/.]/.test(text)) return "literal";
  // camelCase / PascalCase: lowercase letter followed by uppercase (e.g. PutObject).
  if (/[a-z][A-Z]/.test(text)) return "literal";
  return "conceptual";
}

function criterionText(entry: RubricCriterionItem): string {
  return typeof entry === "string" ? entry : entry.text;
}

/**
 * Normalize rubric entries to internal form. Bare strings use the whitespace
 * heuristic for required criteria; explicit type wins when provided.
 */
export function normalizeRubric(rubric: Rubric): {
  required: RubricCriterion[];
  disqualifiers: string[];
  scoring: Rubric["scoring"];
} {
  const required = rubric.required.map((entry) => {
    if (typeof entry === "string") {
      return { text: entry, type: inferRequiredType(entry) };
    }
    return {
      text: entry.text,
      type: entry.type ?? inferRequiredType(entry.text),
    };
  });

  const disqualifiers = rubric.disqualifiers.map(criterionText);

  return { required, disqualifiers, scoring: rubric.scoring };
}

export type Score = "pass" | "partial" | "fail";

export type FailureMode =
  | "silent"
  | "fluent_error"
  | "spec_drift"
  | "hallucination"
  | null;

export interface ModelOutput {
  model: string;
  caseId: string;
  output: string;
  tokensUsed: number;
  latencyMs: number;
  costUsd: number;
}

export interface ScoringResult {
  score: Score;
  failureMode: FailureMode;
  qualityScore: number;       // 0–5
  requiredHits: string[];
  requiredMisses: string[];
  disqualifierHits: string[];
  confidence: "high" | "low";
  raw: {
    outputLength: number;
    hitRate: number;
    judgeVerdicts?: JudgeVerdict[];
  };
}

export interface EvalResult extends ModelOutput {
  category: string;
  score: Score;
  failureMode: FailureMode;
  qualityScore: number;
  requiredHits: string[];
  requiredMisses: string[];
  disqualifierHits: string[];
  confidence: "high" | "low";
  raw: {
    outputLength: number;
    hitRate: number;
    judgeVerdicts?: JudgeVerdict[];
  };
}

export interface RunSummary {
  model: string;
  totalCases: number;
  passCount: number;
  partialCount: number;
  failCount: number;
  passRate: number;            // 0.0–1.0
  avgQualityScore: number;     // 0–5
  totalTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  failureModeCounts: Record<NonNullable<FailureMode>, number>;
  byCategory: Record<string, { pass: number; partial: number; fail: number }>;
}

export interface RunReport {
  runId: string;
  datasetName: string;
  timestamp: string;           // ISO 8601
  models: string[];
  summaries: RunSummary[];
  results: EvalResult[];
}

export type RunReport_Validated = z.infer<typeof RunReportSchema>;


// ── Model Adapter Contract ────────────────────────────────────────────────────

/** What an adapter returns for a single completion (caseId attached by runner). */
export interface CompletionResult {
  output: string;
  tokensUsed: number;
  latencyMs: number;
  costUsd: number;
}

/** Every model provider implements this. The runner treats them uniformly. */
export interface ModelAdapter {
  name: string; // the model id, e.g. "claude-sonnet-5"
  complete(prompt: string): Promise<CompletionResult>;
}