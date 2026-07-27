#!/usr/bin/env bash
# Inspect the current state of the llm-eval-harness project.
# Run from anywhere: bash inspect.sh
# It writes everything to eval-harness-state.txt in the current directory,
# then tells you where that file is so you can upload it.

set -uo pipefail

PROJECT="$HOME/dev/llm-eval-harness"
OUT="eval-harness-state.txt"

# Start clean each run
: > "$OUT"

section() {
  echo ""                              >> "$OUT"
  echo "===== $1 ====="                >> "$OUT"
}

{
  echo "llm-eval-harness state dump"
  echo "generated: $(date)"
  echo "project:   $PROJECT"
} >> "$OUT"

if [ ! -d "$PROJECT" ]; then
  echo "ERROR: $PROJECT not found" >> "$OUT"
  echo "Wrote $OUT (project directory missing)."
  exit 0
fi

cd "$PROJECT" || exit 1

section "types.ts"
cat src/types.ts >> "$OUT" 2>&1

section "models/ dir listing"
ls -la src/models/ >> "$OUT" 2>&1

section "models/*.ts contents"
for f in src/models/*.ts; do
  [ -e "$f" ] || continue
  echo "--- $f ---" >> "$OUT"
  cat "$f"          >> "$OUT" 2>&1
  echo ""           >> "$OUT"
done

section "scorer.ts"
cat src/scorer.ts >> "$OUT" 2>&1

section "dataset: first 80 lines"
head -80 datasets/iam-core-v1.yaml >> "$OUT" 2>&1

section "dataset: case ids"
grep -n "id:" datasets/iam-core-v1.yaml >> "$OUT" 2>&1

section "dashboard/index.html: first 40 lines"
head -40 dashboard/index.html >> "$OUT" 2>&1

section "tsconfig.json"
cat tsconfig.json >> "$OUT" 2>&1

echo ""
echo "Done. Wrote state to: $(pwd)/$OUT"
echo "Upload that file (eval-harness-state.txt) into the chat."
