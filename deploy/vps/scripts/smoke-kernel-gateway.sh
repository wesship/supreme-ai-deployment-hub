#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/supreme-ai-deployment-hub}"
ENV_FILE="${KERNEL_ENV_FILE:-${APP_DIR}/kernel-gateway/.env.production}"
COMPOSE_FILE="${APP_DIR}/docker-compose.kernel-gateway.yml"
SESSION_ID="smoke-$(date +%s)-$$"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: kernel gateway env file not found: $ENV_FILE" >&2
  exit 1
fi

API_TOKEN="$(sed -n 's/^KERNEL_GATEWAY_API_TOKEN=//p' "$ENV_FILE" | tail -n 1)"
if [ -z "$API_TOKEN" ] || printf '%s' "$API_TOKEN" | grep -Eqi '^(replace-with|placeholder|CHANGE_ME|PASTE_)'; then
  echo "ERROR: KERNEL_GATEWAY_API_TOKEN is missing or still a placeholder" >&2
  exit 1
fi

cd "$APP_DIR"
export N8N_IMAGE="${N8N_IMAGE:-unused}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

inside() {
  "${COMPOSE[@]}" exec -T python-kernel-gateway "$@"
}

status_code() {
  inside curl -sS -o /dev/null -w '%{http_code}' "$@"
}

cleanup() {
  if [ -n "${SESSION_TOKEN:-}" ]; then
    inside curl -sS -o /dev/null \
      -X DELETE \
      -H "Authorization: Bearer ${API_TOKEN}" \
      -H "X-Session-Token: ${SESSION_TOKEN}" \
      "http://127.0.0.1:8000/sessions/${SESSION_ID}" || true
  fi
}
trap cleanup EXIT

echo "[1/7] Health endpoint"
inside curl -fsS http://127.0.0.1:8000/health >/dev/null

echo "[2/7] Missing gateway credential must be rejected"
CODE="$(status_code -X POST "http://127.0.0.1:8000/sessions/create/${SESSION_ID}")"
[ "$CODE" = "401" ] || { echo "ERROR: expected 401, received $CODE" >&2; exit 1; }

echo "[3/7] Create authenticated persistent session"
CREATE_RESPONSE="$(inside curl -fsS -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  "http://127.0.0.1:8000/sessions/create/${SESSION_ID}")"
SESSION_TOKEN="$(printf '%s' "$CREATE_RESPONSE" | inside python -c 'import json,sys; print(json.load(sys.stdin)["session_token"])')"
[ -n "$SESSION_TOKEN" ] || { echo "ERROR: session token was not returned" >&2; exit 1; }

echo "[4/7] Wrong session capability must be rejected"
CODE="$(inside curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "X-Session-Token: invalid-capability" \
  -H 'Content-Type: application/json' \
  -d "{\"session_id\":\"${SESSION_ID}\",\"code\":\"print(1)\"}" \
  http://127.0.0.1:8000/execute)"
[ "$CODE" = "403" ] || { echo "ERROR: expected 403, received $CODE" >&2; exit 1; }

echo "[5/7] Load state into persistent kernel memory"
LOAD_RESPONSE="$(inside curl -fsS -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "X-Session-Token: ${SESSION_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"session_id\":\"${SESSION_ID}\",\"code\":\"value = 41\\nprint('loaded')\"}" \
  http://127.0.0.1:8000/execute)"
printf '%s' "$LOAD_RESPONSE" | inside python -c 'import json,sys; d=json.load(sys.stdin); assert d["success"], d; assert "loaded" in d["stdout"], d'

echo "[6/7] Reuse state from a second execution"
QUERY_RESPONSE="$(inside curl -fsS -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "X-Session-Token: ${SESSION_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"session_id\":\"${SESSION_ID}\",\"code\":\"print(value + 1)\"}" \
  http://127.0.0.1:8000/execute)"
printf '%s' "$QUERY_RESPONSE" | inside python -c 'import json,sys; d=json.load(sys.stdin); assert d["success"], d; assert "42" in d["stdout"], d'

echo "[7/7] Destroy session and verify it is gone"
inside curl -fsS -X DELETE \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "X-Session-Token: ${SESSION_TOKEN}" \
  "http://127.0.0.1:8000/sessions/${SESSION_ID}" >/dev/null
SESSION_TOKEN=""
CODE="$(inside curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "X-Session-Token: dead-session" \
  -H 'Content-Type: application/json' \
  -d "{\"session_id\":\"${SESSION_ID}\",\"code\":\"print(1)\"}" \
  http://127.0.0.1:8000/execute)"
[ "$CODE" = "404" ] || { echo "ERROR: expected 404 after destroy, received $CODE" >&2; exit 1; }

echo "Kernel gateway smoke test: PASS"
