import "dotenv/config";

import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import chalk from "chalk";
import { Command } from "commander";
import { createAnthropicAdapter } from "./models/anthropic.js";
import { runEval } from "./runner.js";

const program = new Command();

program
  .name("eval-harness")
  .description("LLM evaluation harness for IAM policy reasoning");

program
  .command("run")
  .description("Run the eval suite against one or more models")
  .option("--dataset <path>", "Path to YAML dataset", "datasets/iam-core-v1.yaml")
  .option(
    "--models <ids>",
    "Comma-separated model ids",
    "claude-sonnet-5"
  )
  .option(
    "--judge <id>",
    "Judge model id (use a different model than --models to reduce self-preference bias)",
    "claude-opus-4-1"
  )
  .option("--out <path>", "Output path for JSON report", "results/latest.json")
  .action(
    async (opts: {
      dataset: string;
      models: string;
      judge: string;
      out: string;
    }) => {
    const modelIds = opts.models
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const judge = createAnthropicAdapter(opts.judge, { temperature: 0 });

    if (modelIds.includes(opts.judge)) {
      console.warn(
        `Warning: judge model "${opts.judge}" is also under test — self-preference bias may affect scores.`
      );
    }

    const adapters = modelIds.map((id) => createAnthropicAdapter(id));
    const report = await runEval(adapters, opts.dataset, judge);

    mkdirSync(dirname(opts.out), { recursive: true });
    writeFileSync(opts.out, JSON.stringify(report, null, 2), "utf8");

    for (const s of report.summaries) {
      console.log(
        `${chalk.bold(s.model)}  ${s.passCount}/${s.totalCases}  ` +
          `${chalk.green((s.passRate * 100).toFixed(1) + "%")}  ` +
          `q=${s.avgQualityScore.toFixed(1)}  ` +
          `$${s.totalCostUsd.toFixed(4)}`
      );
    }
  });

program
  .command("serve")
  .description("Serve the results dashboard")
  .action(() => {
    console.log("serve: not implemented yet");
  });

async function main(): Promise<void> {
  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
