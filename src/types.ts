import { z } from "zod";

// ── Zod Schemas (runtime validation) ─────────────────────────────────────────

export const RubricSchema = z.object({
  required: z.array(z.string()),
  disqualifiers: z.array(z.string()),
  scoring: z.enum(["binary", "rubric"]),
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
      raw: z.object({
        outputLength: z.number(),
        hitRate: z.number(),
      }),
    })
  ),
});

// ── Inferred Types ────────────────────────────────────────────────────────────

export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type Rubric = z.infer<typeof RubricSchema>;

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
    hitRate: number;           // 0.0–1.0
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
  name: string; // the model id, e.g. "claude-sonnet-4-5"
  complete(prompt: string): Promise<CompletionResult>;
}
