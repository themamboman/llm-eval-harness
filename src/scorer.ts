/**
 * LLM Eval Harness — Scorer
 *
 * Applies a rubric to a model's raw output and returns:
 *   - A Score (pass / partial / fail)
 *   - A FailureMode classification when applicable
 *   - A numeric quality score for rubric-mode cases (0–5)
 *
 * FAILURE MODE TAXONOMY
 * ─────────────────────
 * "silent"       — Model produces no signal toward the required answer.
 *                  Output may be generic, vague, or off-topic. The model
 *                  did not engage with the specific domain question.
 *
 * "fluent_error" — Model produces a confident, well-written, WRONG answer.
 *                  At least one disqualifier is present. This is the most
 *                  dangerous failure mode in high-stakes domains (e.g. IAM),
 *                  because it passes a casual human review. Named after
 *                  the "fluency trap" in AI evaluation literature.
 *
 * "spec_drift"   — Model partially addresses the question but misses key
 *                  required elements. It engaged with the domain but drifted
 *                  away from the specific constraint. Partial credit possible.
 *
 * "hallucination"— Model invents specific facts (ARNs, API names, policy keys)
 *                  that do not exist. Distinct from fluent_error because the
 *                  error is fabricated specificity, not wrong reasoning.
 */

import type { FailureMode, Rubric, RunSummary, Score, ScoringResult } from "./types.js";

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
 * This is intentionally permissive — we're looking for evidence of presence,
 * not exact phrasing.
 */
function termPresent(output: string, term: string): boolean {
  return normalize(output).includes(normalize(term));
}

/**
 * Detect hallucinated specificity: model mentions a specific AWS ARN,
 * policy condition key, or API name that looks invented.
 * This is a heuristic check — extend the patterns as you discover new patterns.
 */
function detectHallucination(output: string): boolean {
  const suspiciousPatterns = [
    /arn:aws:[a-z0-9-]+:[a-z0-9-]*:[0-9]{12}:[a-z0-9-\/]+FAKE/i,
    /aws:FakeCondition/i,
    /iam:NonExistentAction/i,
    // Add patterns as you discover them in production runs
  ];
  return suspiciousPatterns.some((pattern) => pattern.test(output));
}

/**
 * Core scoring function.
 *
 * USAGE:
 *   const result = scoreOutput(modelResponse, caseRubric);
 *   console.log(result.score, result.failureMode);
 */
export function scoreOutput(output: string, rubric: Rubric): ScoringResult {
  const requiredHits = rubric.required.filter((r) => termPresent(output, r));
  const requiredMisses = rubric.required.filter((r) => !termPresent(output, r));
  const disqualifierHits = rubric.disqualifiers.filter((d) =>
    termPresent(output, d)
  );

  const hitRate = requiredHits.length / rubric.required.length;
  const outputLength = output.trim().length;

  // Low confidence signal: very short response, likely evasion or refusal
  const confidence: "high" | "low" = outputLength < 80 ? "low" : "high";

  // ── Hallucination check (takes precedence over other failure modes) ──────
  if (detectHallucination(output)) {
    return {
      score: "fail",
      failureMode: "hallucination",
      qualityScore: 0,
      requiredHits,
      requiredMisses,
      disqualifierHits,
      confidence,
      raw: { outputLength, hitRate },
    };
  }

  // ── Fluent error: model is confident but wrong ───────────────────────────
  // A disqualifier being present takes precedence over partial required hits
  if (disqualifierHits.length > 0) {
    return {
      score: "fail",
      failureMode: "fluent_error",
      qualityScore: 0,
      requiredHits,
      requiredMisses,
      disqualifierHits,
      confidence,
      raw: { outputLength, hitRate },
    };
  }

  // ── Silent failure: no signal whatsoever ─────────────────────────────────
  if (hitRate === 0) {
    return {
      score: "fail",
      failureMode: "silent",
      qualityScore: 0,
      requiredHits,
      requiredMisses,
      disqualifierHits,
      confidence,
      raw: { outputLength, hitRate },
    };
  }

  // ── Pass ─────────────────────────────────────────────────────────────────
  if (hitRate === 1.0) {
    if (rubric.scoring === "binary") {
      return {
        score: "pass",
        failureMode: null,
        qualityScore: 5,
        requiredHits,
        requiredMisses,
        disqualifierHits,
        confidence,
        raw: { outputLength, hitRate },
      };
    }

    // Rubric mode: full required hit rate earns a 5, but we still score quality.
    // A future enhancement is to use a secondary LLM call to judge quality (0–5).
    // For now, full hit rate = 5.
    return {
      score: "pass",
      failureMode: null,
      qualityScore: 5,
      requiredHits,
      requiredMisses,
      disqualifierHits,
      confidence,
      raw: { outputLength, hitRate },
    };
  }

  // ── Partial / spec drift: some required terms present, some missing ───────
  // Binary mode has no partial credit
  if (rubric.scoring === "binary") {
    return {
      score: "fail",
      failureMode: "spec_drift",
      qualityScore: Math.round(hitRate * 5),
      requiredHits,
      requiredMisses,
      disqualifierHits,
      confidence,
      raw: { outputLength, hitRate },
    };
  }

  // Rubric mode: partial credit on a 0–5 scale
  const qualityScore = Math.round(hitRate * 5);
  return {
    score: "partial",
    failureMode: "spec_drift",
    qualityScore,
    requiredHits,
    requiredMisses,
    disqualifierHits,
    confidence,
    raw: { outputLength, hitRate },
  };
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
    // Score tallies
    if (result.score === "pass") passCount++;
    else if (result.score === "partial") partialCount++;
    else failCount++;

    // Failure mode tallies
    if (result.failureMode !== null) {
      failureModeCounts[result.failureMode]++;
    }

    // Quality accumulation
    totalQuality += result.qualityScore;

    // Category breakdown
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
    // Token/cost/latency are not available from ScoringResult alone;
    // the runner computes these in its own summarize().
    totalTokens: 0,
    totalCostUsd: 0,
    avgLatencyMs: 0,
    failureModeCounts,
    byCategory,
  };
}
