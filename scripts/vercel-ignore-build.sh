#!/usr/bin/env bash
set -euo pipefail

# Vercel ignores the build when this command exits 0.
# Continue the build when it exits 1.
previous_sha="${VERCEL_GIT_PREVIOUS_SHA:-}"
current_sha="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

if [[ -z "$previous_sha" ]]; then
  echo "No previous successful deployment SHA is available; continue build."
  exit 1
fi

if ! git cat-file -e "${previous_sha}^{commit}" 2>/dev/null; then
  echo "Previous deployment SHA is unavailable in checkout; continue build."
  exit 1
fi

changed_files="$(git diff --name-only "$previous_sha" "$current_sha")"

if [[ -z "$changed_files" ]]; then
  echo "No changed files detected; ignore build."
  exit 0
fi

while IFS= read -r path; do
  case "$path" in
    docs/*|*.md|*.mdx|LICENSE|LICENSE.*|CHANGELOG|CHANGELOG.*)
      ;;
    *)
      echo "Application or infrastructure change detected: $path"
      exit 1
      ;;
  esac
done <<< "$changed_files"

echo "Only documentation files changed; ignore Vercel build."
exit 0
