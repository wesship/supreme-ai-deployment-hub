#!/usr/bin/env bash
# migrate-domain.sh — Replace all d3vonn.io references with d3vonn.io
# This script is idempotent: running it multiple times produces the same result.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Domain Migration: d3vonn.io → d3vonn.io ==="
echo ""

# Files to process (excluding .git, node_modules, and binary files)
FILES=$(grep -rl "d3vonn\.ai" \
  --include="*.yml" --include="*.yaml" \
  --include="*.ts" --include="*.tsx" \
  --include="*.js" --include="*.jsx" \
  --include="*.json" --include="*.md" \
  --include="*.py" --include="*.txt" \
  --include="*.html" --include="*.css" \
  --include="*.conf" --include="*.toml" \
  --include="*.sh" --include="*.rego" \
  --include="*.sql" \
  . 2>/dev/null | grep -v "node_modules" | grep -v "\.git/" || true)

if [ -z "$FILES" ]; then
  echo "No files contain d3vonn.io references. Migration already complete."
  exit 0
fi

echo "Files to update:"
echo "$FILES" | while read -r f; do echo "  $f"; done
echo ""

# Perform replacements
# Order matters: more specific patterns first to avoid double-replacement

for file in $FILES; do
  # Skip the domain migration doc itself (it documents the old domain intentionally)
  if [[ "$file" == *"D3VONN_DOMAIN_MIGRATION.md"* ]]; then
    echo "SKIP (documentation): $file"
    continue
  fi
  
  # Replace URL patterns
  sed -i 's|https://d3vonn\.ai|https://d3vonn.io|g' "$file"
  sed -i 's|http://d3vonn\.ai|https://d3vonn.io|g' "$file"
  sed -i 's|https://www\.d3vonn\.ai|https://www.d3vonn.io|g' "$file"
  sed -i 's|https://api\.d3vonn\.ai|https://api.d3vonn.io|g' "$file"
  sed -i 's|https://dev\.d3vonn\.ai|https://dev.d3vonn.io|g' "$file"
  sed -i 's|https://staging\.d3vonn\.ai|https://staging.d3vonn.io|g' "$file"
  sed -i 's|https://canary\.d3vonn\.ai|https://canary.d3vonn.io|g' "$file"
  sed -i 's|https://staging-api\.d3vonn\.ai|https://staging-api.d3vonn.io|g' "$file"
  sed -i 's|http://deploy\.d3vonn\.ai|https://deploy.d3vonn.io|g' "$file"
  sed -i 's|https://coordinator\.d3vonn\.ai|https://coordinator.d3vonn.io|g' "$file"
  sed -i 's|https://openclaw\.d3vonn\.ai|https://openclaw.d3vonn.io|g' "$file"
  
  # Replace email-style references
  sed -i 's|ci@d3vonn\.ai|ci@d3vonn.io|g' "$file"
  
  # Replace domain-only references (not preceded by a protocol or @)
  sed -i 's|dev\.d3vonn\.ai|dev.d3vonn.io|g' "$file"
  sed -i 's|staging\.d3vonn\.ai|staging.d3vonn.io|g' "$file"
  sed -i 's|canary\.d3vonn\.ai|canary.d3vonn.io|g' "$file"
  sed -i 's|api\.d3vonn\.ai|api.d3vonn.io|g' "$file"
  sed -i 's|deploy\.d3vonn\.ai|deploy.d3vonn.io|g' "$file"
  
  # Catch any remaining bare d3vonn.io references
  sed -i 's|d3vonn\.ai|d3vonn.io|g' "$file"
  
  echo "UPDATED: $file"
done

echo ""
echo "=== Migration complete ==="
echo ""

# Verify no remaining references (excluding the migration doc)
REMAINING=$(grep -rl "d3vonn\.ai" \
  --include="*.yml" --include="*.yaml" \
  --include="*.ts" --include="*.tsx" \
  --include="*.js" --include="*.jsx" \
  --include="*.json" --include="*.md" \
  --include="*.py" --include="*.txt" \
  --include="*.html" --include="*.css" \
  --include="*.conf" --include="*.toml" \
  --include="*.sh" --include="*.rego" \
  --include="*.sql" \
  . 2>/dev/null | grep -v "node_modules" | grep -v "\.git/" | grep -v "D3VONN_DOMAIN_MIGRATION.md" || true)

if [ -n "$REMAINING" ]; then
  echo "WARNING: Some files still contain d3vonn.io references:"
  echo "$REMAINING"
else
  echo "SUCCESS: All d3vonn.io references have been migrated to d3vonn.io"
fi
