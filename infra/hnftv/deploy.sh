#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command '$1' is not installed." >&2
    exit 1
  }
}

need docker
need curl

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose v2 is required (docker compose)." >&2
  exit 1
fi

mkdir -p media tunarr-data recordings

echo "==> Validating compose configuration"
docker compose config >/dev/null

echo "==> Pulling HNF.TV images"
docker compose pull

echo "==> Starting HNF.TV stack"
docker compose up -d

echo "==> Current service state"
docker compose ps

echo
echo "HNF.TV stack started."
echo "Public readiness still depends on DNS for stream.hnfportal.one pointing at this host."
echo "Run ./verify.sh after DNS is active."
