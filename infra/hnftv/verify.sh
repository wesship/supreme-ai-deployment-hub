#!/usr/bin/env bash
set -euo pipefail

ORIGIN="${HNF_TV_ORIGIN:-https://stream.hnfportal.one}"

check() {
  local label="$1"
  local url="$2"
  printf "%-24s " "$label"
  if curl -fsS --max-time 15 "$url" >/dev/null; then
    echo "OK"
    return 0
  fi
  echo "FAIL"
  return 1
}

fail=0

check "Caddy health" "$ORIGIN/healthz" || fail=1
check "HNF.TV canary" "$ORIGIN/hnftv/index.m3u8" || fail=1

for path in peewee academy hiphop chef; do
  if curl -fsS --max-time 15 "$ORIGIN/$path/index.m3u8" >/dev/null; then
    echo "$path: LIVE"
  else
    echo "$path: not live yet"
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo
  echo "Core canary verification failed."
  exit 1
fi

echo
echo "HNF.TV production canary is healthy."
