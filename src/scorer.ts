/**
 * LLM Eval Harness — Scorer
 *
 * Hybrid scoring: deterministic substring matching for literal/code criteria,
 * plus an optional LLM judge for conceptual required criteria and for
 * endorsement-vs-mention on disqualifiers.
 *
 * Without a judge adapter, conceptual criteria and present disqualifiers fall
 * back to substring matching (degraded mode).
 *
 * FAILURE MODE TAXONOMY (precedence unchanged)
 * ─────────────────────
 * "silent"       — Model produces no signal toward the required answer.
 * "fluent_error" — Model produces a confident, well-written, WRONG answer.
 * "spec_drift"   — Model partially addresses the question but misses key elements.
 * "hallucination"— Model invents specific facts that do not exist.
 */

import { judgeCase } from "./judge.js";
import type {
  FailureMode,
  JudgeVerdict,
  ModelAdapter,
  Rubric,
  RubricCriterion,
  RunSummary,
  Score,
  ScoringResult,
} from "./types.js";
import { normalizeRubric } from "./types.js";

export type { FailureMode, Rubric, RunSummary, Score, ScoringResult };

/**
 * Normalize text for matching: lowercase, collapse whitespace.
 * Does NOT strip punctuation so "s3:*" and "s3:PutObject" remain distinct.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Check whether a term appears in the output.
 * Matching is case-insensitive substring match, not word-boundary.
 */
export function termPresent(output: string, term: string): boolean {
  return normalize(output).includes(normalize(term));
}

/**
 * Detect hallucinated specificity: model mentions a specific AWS ARN,
 * policy condition key, or API name that looks invented.
 */
export function detectHallucination(output: string): boolean {
  const suspiciousPatterns = [
    /arn:aws:[a-z0-9-]+:[a-z0-9-]*:[0-9]{12}:[a-z0-9-\/]+FAKE/i,
    /aws:FakeCondition/i,
    /iam:NonExistentAction/i,
  ];
  return suspiciousPatterns.some((pattern) => pattern.test(output));
}

export interface DeterministicPass {
  hallucination: boolean;
  literalHits: string[];
  literalMisses: string[];
  conceptualCriteria: RubricCriterion[];
  presentDisqualifiers: string[];
  outputLength: number;
  needsJudge: boolean;
}

/**
 * Pure synchronous pass: hallucination check, literal required hits/misses,
 * and disqualifier substring gate. Does not finalize a score when judge input
 * is required.
 */
export function deterministicPass(
  output: string,
  rubric: Rubric
): DeterministicPass {
  const normalized = normalizeRubric(rubric);
  const outputLength = output.trim().length;

  const literalHits: string[] = [];
  const literalMisses: string[] = [];
  const conceptualCriteria: RubricCriterion[] = [];

  for (const criterion of normalized.required) {
    if (criterion.type === "literal") {
      if (termPresent(output, criterion.text)) {
        literalHits.push(criterion.text);
      } else {
        literalMisses.push(criterion.text);
      }
    } else {
      conceptualCriteria.push(criterion);
    }
  }

  const presentDisqualifiers = normalized.disqualifiers.filter((d) =>
    termPresent(output, d)
  );

  const needsJudge =
    conceptualCriteria.length > 0 || presentDisqualifiers.length > 0;

  return {
    hallucination: detectHallucination(output),
    literalHits,
    literalMisses,
    conceptualCriteria,
    presentDisqualifiers,
    outputLength,
    needsJudge,
  };
}

function applyScoringPrecedence(
  scoringMode: Rubric["scoring"],
  requiredHits: string[],
  requiredMisses: string[],
  disqualifierHits: string[],
  outputLength: number,
  judgeVerdicts?: JudgeVerdict[]
): ScoringResult {
  const totalRequired = requiredHits.length + requiredMisses.length;
  const hitRate =
    totalRequired > 0 ? requiredHits.length / totalRequired : 0;
  const confidence: "high" | "low" = outputLength < 80 ? "low" : "high";
  const raw = {
    outputLength,
    hitRate,
    ...(judgeVerdicts !== undefined ? { judgeVerdicts } : {}),
  };

  if (disqualifierHits.length > 0) {
    return {
      score: "fail",
      failureMode: "fluent_error",
      qualityScore: 0,
      requiredHits,
      requiredMisses,
      disqualifierHits,
      confidence,
      raw,
    };
  }

  if (hitRate === 0) {
    return {
      score: "fail",
      failureMode: "silent",
      qualityScore: 0,
      requiredHits,
      requiredMisses,
      disqualifierHits,
      confidence,
      raw,
    };
  }

  if (hitRate === 1.0) {
    return {
      score: "pass",
      failureMode: null,
      qualityScore: 5,
      requiredHits,
      requiredMisses,
      disqualifierHits,
      confidence,
      raw,
    };
  }

  if (scoringMode === "binary") {
    return {
      score: "fail",
      failureMode: "spec_drift",
      qualityScore: Math.round(hitRate * 5),
      requiredHits,
      requiredMisses,
      disqualifierHits,
      confidence,
      raw,
    };
  }

  return {
    score: "partial",
    failureMode: "spec_drift",
    qualityScore: Math.round(hitRate * 5),
    requiredHits,
    requiredMisses,
    disqualifierHits,
    confidence,
    raw,
  };
}

/**
 * Score a model output against a rubric. Literal criteria use substring matching;
 * conceptual required and present disqualifiers use the judge when provided.
 */
export async function scoreOutput(
  output: string,
  rubric: Rubric,
  judge?: ModelAdapter
): Promise<ScoringResult> {
  const normalized = normalizeRubric(rubric);
  const det = deterministicPass(output, rubric);
  const { outputLength } = det;

  if (det.hallucination) {
    const totalRequired = normalized.required.length;
    const hitRate =
      totalRequired > 0 ? det.literalHits.length / totalRequired : 0;
    return {
      score: "fail",
      failureMode: "hallucination",
      qualityScore: 0,
      requiredHits: det.literalHits,
      requiredMisses: [
        ...det.literalMisses,
        ...det.conceptualCriteria.map((c) => c.text),
      ],
      disqualifierHits: det.presentDisqualifiers,
      confidence: outputLength < 80 ? "low" : "high",
      raw: { outputLength, hitRate },
    };
  }

  let judgeVerdicts: JudgeVerdict[] | undefined;

  if (det.needsJudge) {
    if (judge) {
      judgeVerdicts = await judgeCase(
        judge,
        output,
        det.conceptualCriteria.map((c) => c.text),
        det.presentDisqualifiers
      );
    } else {
      console.warn(
        "Scoring in degraded/no-judge mode: conceptual criteria and present disqualifiers use substring matching only."
      );
    }
  }

  const requiredHits = [...det.literalHits];
  const requiredMisses = [...det.literalMisses];

  for (const criterion of det.conceptualCriteria) {
    if (judge && judgeVerdicts) {
      const verdict = judgeVerdicts.find(
        (v) => v.kind === "required" && v.criterion === criterion.text
      );
      if (verdict?.met) {
        requiredHits.push(criterion.text);
      } else {
        requiredMisses.push(criterion.text);
      }
    } else if (termPresent(output, criterion.text)) {
      requiredHits.push(criterion.text);
    } else {
      requiredMisses.push(criterion.text);
    }
  }

  const disqualifierHits: string[] = [];
  for (const term of det.presentDisqualifiers) {
    if (judge && judgeVerdicts) {
      const verdict = judgeVerdicts.find(
        (v) => v.kind === "disqualifier" && v.criterion === term
      );
      if (verdict?.met) {
        disqualifierHits.push(term);
      }
    } else {
      disqualifierHits.push(term);
    }
  }

  return applyScoringPrecedence(
    normalized.scoring,
    requiredHits,
    requiredMisses,
    disqualifierHits,
    outputLength,
    judgeVerdicts
  );
}

/**
 * Aggregate scores across all cases for a single model run.
 * Returns the summary stats you'd show in the dashboard.
 */
export function aggregateResults(
  model: string,
  results: Array<{ caseId: string; category: string; result: ScoringResult }>
): RunSummary {
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

  for (const { category, result } of results) {
    if (result.score === "pass") passCount++;
    else if (result.score === "partial") partialCount++;
    else failCount++;

    if (result.failureMode !== null) {
      failureModeCounts[result.failureMode]++;
    }

    totalQuality += result.qualityScore;

    if (!byCategory[category]) {
      byCategory[category] = { pass: 0, partial: 0, fail: 0 };
    }
    byCategory[category][result.score]++;
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
    totalTokens: 0,
    totalCostUsd: 0,
    avgLatencyMs: 0,
    failureModeCounts,
    byCategory,
  };
}
