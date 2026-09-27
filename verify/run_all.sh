#!/usr/bin/env bash
# Re-run every verification layer against Microsoft's current sources.
# Needs: python3, git, network access to github.com and raw.githubusercontent.com.
# Optional: Azure CLI (pip install azure-cli) for the CLI check.
set -u
cd "$(dirname "$0")/.."
ENTRA_DOCS="${ENTRA_DOCS:-.cache/entra-docs/docs}"
if [ ! -d "$ENTRA_DOCS" ]; then
  echo "Fetching Microsoft Entra docs (markdown only, sparse clone)..."
  mkdir -p .cache && rm -rf .cache/entra-docs
  git clone --depth 1 --filter=blob:none --sparse https://github.com/MicrosoftDocs/entra-docs .cache/entra-docs >/dev/null 2>&1
  (cd .cache/entra-docs && git sparse-checkout set --no-cone '/docs/**/*.md' '/docs/**/*.yml' >/dev/null 2>&1)
fi
export ENTRA_DOCS
fail=0; : > verify/out/summary.md 2>/dev/null || { mkdir -p verify/out; : > verify/out/summary.md; }
echo "# Verification run $(date -u +%Y-%m-%dT%H:%MZ)" >> verify/out/summary.md
for check in outline links kql cmdlets cli facts answerkeys; do
  echo "== $check"
  out=$(python3 verify/$check.py 2>&1); rc=$?
  echo "$out" | tail -8
  status=PASS; [ $rc -ne 0 ] && { status=FAIL; fail=1; }
  echo "- **$check**: $status - $(echo "$out" | tail -1)" >> verify/out/summary.md
done
cat verify/out/summary.md
exit $fail
