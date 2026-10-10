#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/vps/docker-compose.yml"
ENV_FILE="$ROOT_DIR/deploy/vps/env/.env.production"
REPORT_FILE="${REPORT_FILE:-/root/d3vonn-vps-health-audit.txt}"

pass_count=0
fail_count=0
warn_count=0

section() {
  printf '\n==== %s ====\n' "$1"
}

pass() {
  pass_count=$((pass_count + 1))
  printf '[PASS] %s\n' "$1"
}

fail() {
  fail_count=$((fail_count + 1))
  printf '[FAIL] %s\n' "$1"
}

warn() {
  warn_count=$((warn_count + 1))
  printf '[WARN] %s\n' "$1"
}

run_check() {
  local label="$1"
  shift
  if "$@" >/tmp/d3vonn-audit-check.out 2>&1; then
    pass "$label"
    cat /tmp/d3vonn-audit-check.out
  else
    fail "$label"
    cat /tmp/d3vonn-audit-check.out
  fi
}

check_container_up() {
  local name="$1"
  local status
  status="$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || true)"
  if [[ "$status" == "running" ]]; then
    pass "$name is running"
  else
    fail "$name is not running; status=${status:-missing}"
  fi
}

check_container_health() {
  local name="$1"
  local health
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$name" 2>/dev/null || true)"
  case "$health" in
    healthy) pass "$name healthcheck is healthy" ;;
    no-healthcheck) warn "$name has no Docker healthcheck" ;;
    *) fail "$name healthcheck is ${health:-missing}" ;;
  esac
}

main() {
  mkdir -p "$(dirname "$REPORT_FILE")"
  exec > >(tee "$REPORT_FILE") 2>&1

  section "D3VONN VPS Health Audit"
  date -u '+UTC %Y-%m-%d %H:%M:%S'
  echo "ROOT_DIR=$ROOT_DIR"
  echo "COMPOSE_FILE=$COMPOSE_FILE"
  echo "ENV_FILE=$ENV_FILE"
  echo "REPORT_FILE=$REPORT_FILE"

  section "Prerequisites"
  command -v docker >/dev/null 2>&1 && pass "docker command found" || fail "docker command missing"
  docker compose version >/dev/null 2>&1 && pass "docker compose available" || fail "docker compose missing"
  [[ -f "$COMPOSE_FILE" ]] && pass "docker-compose.yml found" || fail "docker-compose.yml missing"
  [[ -f "$ENV_FILE" ]] && pass ".env.production found" || fail ".env.production missing"

  section "Compose Status"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps || true

  section "Container Runtime Checks"
  for c in \
    d3vonn-backend \
    d3vonn-nginx \
    d3vonn-redis \
    d3vonn-celery-worker \
    d3vonn-celery-beat \
    d3vonn-hermes \
    d3vonn-knowledge-graph \
    d3vonn-opportunity-agent \
    d3vonn-security-agent
  do
    check_container_up "$c"
  done

  section "Container Healthchecks"
  for c in d3vonn-backend d3vonn-nginx d3vonn-redis; do
    check_container_health "$c"
  done

  section "HTTP Smoke Tests"
  run_check "Nginx /health returns OK" curl -fsS --max-time 10 http://localhost/health
  run_check "Backend health through Nginx /health/live" curl -fsS --max-time 10 http://localhost/health/live
  run_check "Backend health through Nginx /api/health/live" curl -fsS --max-time 10 http://localhost/api/health/live
  run_check "Backend direct health inside container" docker exec d3vonn-backend curl -fsS --max-time 10 http://localhost:8000/health/live

  section "Redis Smoke Test"
  run_check "Redis PING returns PONG" docker exec d3vonn-redis redis-cli ping

  section "Celery Logs"
  docker logs --tail=40 d3vonn-celery-worker || true
  docker logs --tail=40 d3vonn-celery-beat || true

  section "Hermes Logs"
  docker logs --tail=40 d3vonn-hermes || true

  section "System Resources"
  df -h / || true
  free -h || true
  docker system df || true

  section "Open Ports"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true

  section "Summary"
  echo "PASS=$pass_count WARN=$warn_count FAIL=$fail_count"

  if [[ "$fail_count" -gt 0 ]]; then
    echo "D3VONN VPS health audit completed with failures. See $REPORT_FILE"
    exit 1
  fi

  echo "D3VONN VPS health audit passed. Report saved to $REPORT_FILE"
}

main "$@"
