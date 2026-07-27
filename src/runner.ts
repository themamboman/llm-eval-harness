import { readFileSync } from "fs";
import { basename } from "path";
import { load } from "js-yaml";
import { randomUUID } from "crypto";
import { scoreOutput } from "./scorer.js";
import {
  EvalCaseSchema,
  RunReportSchema,
  type EvalCase,
  type EvalResult,
  type FailureMode,
  type ModelAdapter,
  type RunReport,
  type RunSummary,
  type ScoringResult,
} from "./types.js";

interface DatasetMeta {
  name: string;
  [key: string]: unknown;
}

interface DatasetFile {
  meta: DatasetMeta;
  cases: unknown[];
}

/** Load a YAML dataset and validate every case against EvalCaseSchema. */
export function loadDataset(filePath: string): {
  meta: DatasetMeta;
  cases: EvalCase[];
} {
  const raw = readFileSync(filePath, "utf8");
  const parsed = load(raw) as DatasetFile;

  if (!parsed || !Array.isArray(parsed.cases)) {
    throw new Error(`Dataset at ${filePath} must have a top-level "cases" array`);
  }

  const cases: EvalCase[] = [];
  for (const entry of parsed.cases) {
    const id =
      entry && typeof entry === "object" && "id" in entry
        ? String((entry as { id: unknown }).id)
        : "<unknown>";
    try {
      cases.push(EvalCaseSchema.parse(entry));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid eval case "${id}": ${message}`);
    }
  }

  return { meta: parsed.meta ?? { name: basename(filePath) }, cases };
}

/** Prompt for a case: question text only, trimmed. */
export function buildPrompt(evalCase: EvalCase): string {
  return evalCase.question.trim();
}

/**
 * Run one model over all cases: complete → score → EvalResult.
 * Cases are processed sequentially so latency/cost stay attributable per case.
 */
export async function runModel(
  adapter: ModelAdapter,
  cases: EvalCase[]
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];

  for (const evalCase of cases) {
    const completion = await adapter.complete(buildPrompt(evalCase));
    const scoring: ScoringResult = scoreOutput(
      completion.output,
      evalCase.rubric
    );

    results.push({
      model: adapter.name,
      caseId: evalCase.id,
      category: evalCase.category,
      output: completion.output,
      tokensUsed: completion.tokensUsed,
      latencyMs: completion.latencyMs,
      costUsd: completion.costUsd,
      score: scoring.score,
      failureMode: scoring.failureMode,
      qualityScore: scoring.qualityScore,
      requiredHits: scoring.requiredHits,
      requiredMisses: scoring.requiredMisses,
      disqualifierHits: scoring.disqualifierHits,
      confidence: scoring.confidence,
      raw: scoring.raw,
    });
  }

  return results;
}

/** Fold EvalResults into a complete RunSummary (including token/cost/latency). */
function summarize(model: string, results: EvalResult[]): RunSummary {
  const failureModeCounts: Record<NonNullable<FailureMode>, number> = {
    silent: 0,
    fluent_error: 0,
    spec_drift: 0,
    hallucination: 0,
  };

  const byCategory: Record<
    string,
    { pass: number; partial: number; fail: number }
  > = {};

  let passCount = 0;
  let partialCount = 0;
  let failCount = 0;
  let totalQuality = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;
  let totalLatencyMs = 0;

  for (const r of results) {
    if (r.score === "pass") passCount++;
    else if (r.score === "partial") partialCount++;
    else failCount++;

    if (r.failureMode !== null) {
      failureModeCounts[r.failureMode]++;
    }

    totalQuality += r.qualityScore;
    totalTokens += r.tokensUsed;
    totalCostUsd += r.costUsd;
    totalLatencyMs += r.latencyMs;

    if (!byCategory[r.category]) {
      byCategory[r.category] = { pass: 0, partial: 0, fail: 0 };
    }
    byCategory[r.category][r.score]++;
  }

  const totalCases = results.length;

  return {
    model,
    totalCases,
    passCount,
    partialCount,
    failCount,
    passRate: totalCases > 0 ? passCount / totalCases : 0,
    avgQualityScore: totalCases > 0 ? totalQuality / totalCases : 0,
    totalTokens,
    totalCostUsd,
    avgLatencyMs: totalCases > 0 ? totalLatencyMs / totalCases : 0,
    failureModeCounts,
    byCategory,
  };
}

/**
 * Full eval: load dataset, run every adapter over every case, assemble RunReport.
 */
export async function runEval(
  adapters: ModelAdapter[],
  datasetPath: string
): Promise<RunReport> {
  const { meta, cases } = loadDataset(datasetPath);

  const results: EvalResult[] = [];
  const summaries: RunSummary[] = [];

  for (const adapter of adapters) {
    const modelResults = await runModel(adapter, cases);
    results.push(...modelResults);
    summaries.push(summarize(adapter.name, modelResults));
  }

  const report: RunReport = {
    runId: randomUUID(),
    datasetName: meta.name ?? basename(datasetPath),
    timestamp: new Date().toISOString(),
    models: adapters.map((a) => a.name),
    summaries,
    results,
  };

  return RunReportSchema.parse(report);
}
