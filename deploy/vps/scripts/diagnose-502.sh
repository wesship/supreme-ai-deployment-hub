#!/usr/bin/env bash
set -uo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/supreme-ai-deployment-hub}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/vps/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-deploy/vps/env/.env.production}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-d3vonn-backend}"
NGINX_CONTAINER="${NGINX_CONTAINER:-d3vonn-nginx}"
PUBLIC_URL="${PUBLIC_URL:-https://api.d3vonn.io/health/ready}"

section() {
  printf '\n===== %s =====\n' "$1"
}

run() {
  printf '+ %q ' "$@"
  printf '\n'
  "$@" 2>&1 || true
}

cd "$REPO_ROOT" || {
  echo "ERROR: repository not found at $REPO_ROOT"
  exit 1
}

section "Git state"
run git status --short --branch
run git log -1 --oneline

section "Compose validation"
run docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
run docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

section "Backend container state"
run docker inspect "$BACKEND_CONTAINER" --format '{{json .State}}'
run docker logs --tail=150 "$BACKEND_CONTAINER"

section "Host to backend"
run curl -i --max-time 10 http://127.0.0.1:8000/health/live
run curl -i --max-time 10 http://127.0.0.1:8000/health/ready

section "Nginx to backend"
run docker exec "$NGINX_CONTAINER" wget -S -O- -T 10 http://backend:8000/health/live
run docker exec "$NGINX_CONTAINER" wget -S -O- -T 10 http://backend:8000/health/ready

section "Active Nginx routing and security headers"
run docker exec "$NGINX_CONTAINER" sh -c \
  "nginx -T 2>&1 | grep -E 'Strict-Transport|Content-Security|Permissions-Policy|Referrer-Policy|proxy_pass|server_name api.d3vonn.io'"

section "Host Nginx routing and security headers"
run grep -E \
  'Strict-Transport|Content-Security|Permissions-Policy|Referrer-Policy|proxy_pass|server_name api.d3vonn.io' \
  deploy/vps/nginx/conf.d/d3vonn.conf

section "Docker networking"
run docker inspect "$BACKEND_CONTAINER" --format '{{json .NetworkSettings.Networks}}'
run docker inspect "$NGINX_CONTAINER" --format '{{json .NetworkSettings.Networks}}'

section "Public endpoint"
run curl -i --max-time 15 "$PUBLIC_URL"

section "Secret hygiene reminder"
echo "Review output before sharing. Redact tokens, passwords, cookies, authorization headers, and connection strings."

echo
echo "Diagnosis complete. The rollout is not complete while the public endpoint returns 502 or readiness is not HTTP 200."
