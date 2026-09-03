import { randomUUID } from "crypto";
import {
  AggregateReportSchema,
  type AggregateReport,
  type CaseStability,
  type ModelAggregate,
  type RunReport,
  type StatRange,
} from "./types.js";

/**
 * Mean, sample std (N-1), min, max. When N === 1, std is 0.
 */
export function meanStd(values: number[]): StatRange {
  if (values.length === 0) {
    return { mean: 0, std: 0, min: 0, max: 0 };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (values.length === 1) {
    return { mean, std: 0, min, max };
  }

  const sumSq = values.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  const std = Math.sqrt(sumSq / (values.length - 1));
  return { mean, std, min, max };
}

function emptyFailureModeCounts(): ModelAggregate["failureModeCountsTotal"] {
  return {
    silent: 0,
    fluent_error: 0,
    spec_drift: 0,
    hallucination: 0,
  };
}

function aggregateModel(
  model: string,
  reports: RunReport[]
): ModelAggregate {
  const n = reports.length;
  const summaries = reports.map((r) => {
    const s = r.summaries.find((x) => x.model === model);
    if (!s) {
      throw new Error(`Missing summary for model "${model}" in a run report`);
    }
    return s;
  });

  const passRate = meanStd(summaries.map((s) => s.passRate));
  const avgQualityScore = meanStd(summaries.map((s) => s.avgQualityScore));
  const totalCostUsd = summaries.reduce((sum, s) => sum + s.totalCostUsd, 0);
  const costPerRunMean = n > 0 ? totalCostUsd / n : 0;

  const failureModeCountsTotal = emptyFailureModeCounts();
  for (const s of summaries) {
    failureModeCountsTotal.silent += s.failureModeCounts.silent;
    failureModeCountsTotal.fluent_error += s.failureModeCounts.fluent_error;
    failureModeCountsTotal.spec_drift += s.failureModeCounts.spec_drift;
    failureModeCountsTotal.hallucination += s.failureModeCounts.hallucination;
  }

  const perCase: Record<string, CaseStability> = {};
  for (const report of reports) {
    for (const result of report.results) {
      if (result.model !== model) continue;
      if (!perCase[result.caseId]) {
        perCase[result.caseId] = {
          passes: 0,
          partials: 0,
          fails: 0,
          runs: n,
          passFrequency: 0,
        };
      }
      const entry = perCase[result.caseId];
      if (result.score === "pass") entry.passes++;
      else if (result.score === "partial") entry.partials++;
      else entry.fails++;
    }
  }

  for (const entry of Object.values(perCase)) {
    entry.runs = n;
    entry.passFrequency = n > 0 ? entry.passes / n : 0;
  }

  return {
    model,
    runs: n,
    passRate,
    avgQualityScore,
    totalCostUsd,
    costPerRunMean,
    perCase,
    failureModeCountsTotal,
  };
}

/**
 * Fold N RunReports into one AggregateReport with per-model consistency stats.
 */
export function aggregateReports(reports: RunReport[]): AggregateReport {
  if (reports.length === 0) {
    throw new Error("aggregateReports requires at least one RunReport");
  }

  const models = reports[0].models;
  for (const report of reports) {
    if (
      report.models.length !== models.length ||
      report.models.some((m, i) => m !== models[i])
    ) {
      throw new Error("All RunReports must cover the same models in the same order");
    }
  }

  const aggregate = models.map((model) => aggregateModel(model, reports));

  const report: AggregateReport = {
    runId: randomUUID(),
    datasetName: reports[0].datasetName,
    timestamp: new Date().toISOString(),
    models,
    runs: reports.length,
    aggregate,
    runReports: reports,
  };

  return AggregateReportSchema.parse(report);
}
