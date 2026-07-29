# IAM LLM Evaluation Harness

An evaluation harness that measures how well large language models reason about **identity and access management (IAM) policy** — not whether they *sound* fluent, but whether they get authorization *right*.

In IAM, a plausible-sounding answer that grants one extra permission is a security incident. General-purpose LLM benchmarks reward fluent, plausible output; they don't test the thing that actually causes breaches. This harness does — and it reports *how* a model fails, not just whether it did, with per-case cost and latency attribution so model selection is an economic decision rather than a guess.

---

## Why IAM specifically

A model can score well on a general benchmark and still write an S3 policy with `s3:*` in it, or design an "auditor" role that quietly inherits admin privileges. These are the failures that matter in production identity systems, and they're invisible to accuracy-only evals. The dataset here targets least-privilege policy authoring, RBAC role design, multi-tenant isolation, and authorization edge cases — the reasoning where being *confidently wrong* is most dangerous.

---

## Quickstart

Requires Node 20+.

```bash
npm install

# Provide API keys (never commit real keys — .env is gitignored)
cp .env.example .env
# then edit .env and fill in ANTHROPIC_API_KEY (and others as needed)

# Run the suite
npm run run-eval
```

By default this evaluates `claude-sonnet-5` against `datasets/iam-core-v1.yaml`, using a separate, stronger model (`claude-opus-4-1`) as the scoring judge, and writes a full report to `results/latest.json`.

Useful options:

```bash
# Choose the model(s) under test
npm run run-eval -- --models claude-sonnet-5

# Choose the judge model (defaults to a model different from the one under test)
npm run run-eval -- --judge claude-opus-4-1

# Point at a different dataset or output path
npm run run-eval -- --dataset datasets/iam-core-v1.yaml --out results/latest.json
```

---

## How scoring works

Each dataset case carries a rubric of **required** criteria and **disqualifiers**. The harness scores an answer through a hybrid of deterministic checks and an LLM judge, then classifies any failure by *mode*.

### Hybrid scoring

Pure keyword matching is too brittle for reasoning tasks — it fails good answers that paraphrase a concept, and it penalizes models for *naming* an anti-pattern in order to warn against it. So criteria are routed:

- **Literal criteria** — genuine code/API tokens (`s3:PutObject`, `arn:aws:s3:::`, camelCase API names) are matched deterministically by substring. Exact presence is what matters, so no judgment is needed.
- **Conceptual criteria** — prose ideas ("no write permissions", "tenant isolation") are evaluated by an LLM judge that decides whether the *idea* is expressed, regardless of exact wording.
- **Disqualifiers** — checked with a cheap substring gate first; only if the anti-pattern term actually appears does the judge decide whether the answer **recommends/uses** it versus merely **mentions it to warn against it**. Only genuine endorsement fails the case.

Routing is automatic (a heuristic sends code-shaped tokens to the literal path and everything else to the judge), and any criterion can be tagged explicitly in the rubric with `{ text, type }` to override. The design bias is toward the judge: the judge subsumes substring matching, so over-routing to it costs a small API call, while under-routing to literal matching causes false failures.

The judge runs at temperature 0 for reproducibility, defaults to a **different model than the one under test** to control for self-preference bias, and its per-criterion reasoning is written into the report as an audit trail. A judge parse failure throws loudly rather than silently scoring a case wrong.

### Failure-mode taxonomy

Every failure is classified, because *how* a model fails is more actionable than a raw pass rate:

- **silent** — no usable signal toward the answer; the model didn't engage the question.
- **fluent_error** — a confident, well-written, *wrong* answer that endorses a disqualified anti-pattern. The most dangerous mode in a security domain, because it survives a casual human review.
- **spec_drift** — engaged the domain but missed required elements. Partial credit possible.
- **hallucination** — invented specific constructs (ARNs, condition keys, API names) that don't exist.

---

## Sample output

The run prints a per-model summary line:

```
claude-sonnet-5  16/18  88.9%  q=4.8  $0.2709
```

...and writes a full `results/latest.json` with per-case scores, failure modes, rubric hits/misses, cost/latency/tokens, and — for judged criteria — the judge's reasoning. A judged verdict looks like this:

```json
{
  "criterion": "no write permissions",
  "kind": "required",
  "met": true,
  "reason": "The answer lists Create/Update/Delete as denied permissions, satisfying the 'no write permissions' requirement despite not using that exact phrase."
}
```

That reasoning is the point: a passing score reflects a correct answer, and you can inspect *why* every case scored the way it did.

---

## A note on methodology

An early run scored 16.7% under naive substring scoring. Inspection showed the scorer was the problem, not the models — it was failing good answers on paraphrase and penalizing them for warning against anti-patterns. Under hybrid scoring, the *identical* model outputs scored 88.9%. The 71-point gap is a concrete measure of how much a keyword-matching eval underreports real model capability. Auditing the evaluator — repeatedly — is treated here as a first-class part of the work, not an afterthought.

---

## Architecture

```
src/
  cli.ts          # commander CLI: run command, model/judge/dataset options
  runner.ts       # loads + validates dataset, runs each model over each case
  scorer.ts       # deterministic pass + hybrid orchestration, failure classification
  judge.ts        # batched LLM-as-judge; strict-JSON, fail-loud
  types.ts        # Zod schemas + inferred types (rubric, results, report)
  models/
    anthropic.ts  # Anthropic adapter (wired end-to-end)
    openai.ts     # OpenAI adapter
    deepseek.ts   # DeepSeek adapter
datasets/
  iam-core-v1.yaml
results/
  latest.json     # written per run (schema-validated)
```

All model providers implement a single `ModelAdapter` interface, so the runner treats them uniformly and the judge reuses the same contract. Dataset cases and the final report are validated against Zod schemas, so malformed input fails loudly at parse time.

---

## Status & roadmap

This is an actively developed project. Current state:

- **Working:** end-to-end runs, hybrid scoring with LLM judge, failure-mode taxonomy, per-case cost/latency/token attribution, category breakdown, schema-validated JSON reports, Anthropic adapter.
- **In progress:**
  - Results dashboard — the `serve` command is scaffolded; CSV + HTML reporter to follow.
  - Dataset depth — 18 of a planned 30 cases.
  - OpenAI / DeepSeek adapters — present in the codebase, to be validated end-to-end for true cross-vendor comparison (and cross-vendor judging).
  - Holistic quality scoring — the judge currently confirms criteria; a 0–5 holistic quality verdict is a planned extension.

---

## License

TBD.
