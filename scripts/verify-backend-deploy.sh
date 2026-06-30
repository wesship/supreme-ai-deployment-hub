#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${1:-}"
ADMIN_JWT="${ADMIN_JWT:-}"
NON_ADMIN_JWT="${NON_ADMIN_JWT:-}"

if [[ -z "$BACKEND_URL" ]]; then
  echo "Usage: scripts/verify-backend-deploy.sh https://<backend-url>"
  echo "Optional env vars: ADMIN_JWT, NON_ADMIN_JWT"
  exit 1
fi

BACKEND_URL="${BACKEND_URL%/}"

echo "== Devonn.ai backend deployment verification =="
echo "Backend: $BACKEND_URL"
echo

echo "[1/4] Health check"
curl -fsS -i "$BACKEND_URL/health" || {
  echo
  echo "Health check failed"
  exit 1
}
echo

echo "[2/4] Public admin endpoint must not leak data"
PUBLIC_STATUS=$(curl -s -o /tmp/d3vonn_public_admin_response.txt -w "%{http_code}" "$BACKEND_URL/api/admin/overview" || true)
echo "HTTP $PUBLIC_STATUS"
cat /tmp/d3vonn_public_admin_response.txt || true
echo

if [[ "$PUBLIC_STATUS" == "200" ]]; then
  echo "SECURITY FAIL: public admin endpoint returned 200. Investigate immediately."
  exit 1
fi

if [[ -n "$NON_ADMIN_JWT" ]]; then
  echo "[3/4] Non-admin request should be denied"
  NON_ADMIN_STATUS=$(curl -s -o /tmp/d3vonn_non_admin_response.txt -w "%{http_code}" \
    -H "Authorization: Bearer $NON_ADMIN_JWT" \
    "$BACKEND_URL/api/admin/overview" || true)
  echo "HTTP $NON_ADMIN_STATUS"
  cat /tmp/d3vonn_non_admin_response.txt || true
  echo

  if [[ "$NON_ADMIN_STATUS" == "200" ]]; then
    echo "SECURITY FAIL: non-admin user received admin data."
    exit 1
  fi
else
  echo "[3/4] Skipped non-admin JWT check — set NON_ADMIN_JWT to enable"
fi

if [[ -n "$ADMIN_JWT" ]]; then
  echo "[4/4] Admin request should succeed"
  ADMIN_STATUS=$(curl -s -o /tmp/d3vonn_admin_response.txt -w "%{http_code}" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    "$BACKEND_URL/api/admin/overview" || true)
  echo "HTTP $ADMIN_STATUS"
  cat /tmp/d3vonn_admin_response.txt || true
  echo

  if [[ "$ADMIN_STATUS" != "200" ]]; then
    echo "Admin verification failed: expected HTTP 200."
    exit 1
  fi
else
  echo "[4/4] Skipped admin JWT check — set ADMIN_JWT to enable"
fi

echo

echo "Verification complete. Public admin access did not return 200."
