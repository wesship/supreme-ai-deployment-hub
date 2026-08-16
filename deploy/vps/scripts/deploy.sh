#!/usr/bin/env bash
# =============================================================================
# D3VONN.IO — Hostinger VPS Deployment Script
# =============================================================================
# Usage:
#   sudo APP_DIR=/opt/supreme-ai-deployment-hub bash deploy/vps/scripts/deploy.sh
#   sudo APP_DIR=/opt/supreme-ai-deployment-hub bash deploy/vps/scripts/deploy.sh --service backend
#   sudo APP_DIR=/opt/supreme-ai-deployment-hub bash deploy/vps/scripts/deploy.sh --rollback
#   sudo APP_DIR=/opt/supreme-ai-deployment-hub bash deploy/vps/scripts/deploy.sh --status
# =============================================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/supreme-ai-deployment-hub}"
BRANCH="${BRANCH:-main}"
PROJECT_DIR="${APP_DIR}"
COMPOSE_DIR="${PROJECT_DIR}/deploy/vps"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
MONITORING_FILE="${COMPOSE_DIR}/docker-compose.monitoring.yml"
ENV_FILE="${ENV_FILE:-${COMPOSE_DIR}/env/.env.production}"
EXAMPLE_ENV="${COMPOSE_DIR}/env/.env.example"
VALIDATE_SCRIPT="${COMPOSE_DIR}/scripts/validate-production-env.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()     { echo -e "[$(date -Iseconds)] $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠️${NC} $1"; }
error()   { echo -e "${RED}❌${NC} $1"; }

ACTION="deploy"
SERVICE=""
WITH_MONITORING=false
SKIP_VALIDATE=false
SKIP_GIT_SYNC="${SKIP_GIT_SYNC:-false}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --rollback)       ACTION="rollback"; shift ;;
        --status)         ACTION="status"; shift ;;
        --service)        SERVICE="$2"; shift 2 ;;
        --with-monitoring) WITH_MONITORING=true; shift ;;
        --skip-validate)  SKIP_VALIDATE=true; shift ;;
        --help)           ACTION="help"; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

show_help() {
    echo "D3VONN.IO Hostinger VPS Deployment Script"
    echo ""
    echo "Usage: sudo APP_DIR=/opt/supreme-ai-deployment-hub bash deploy/vps/scripts/deploy.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --service NAME       Deploy a specific service only"
    echo "  --with-monitoring    Include monitoring stack"
    echo "  --skip-validate      Skip production env validation (not recommended)"
    echo "  --rollback           Rollback to previous version"
    echo "  --status             Show current deployment status"
    echo "  --help               Show this help message"
    echo ""
    echo "Environment overrides:"
    echo "  APP_DIR              Repo path. Default: /opt/supreme-ai-deployment-hub"
    echo "  ENV_FILE             Env path. Default: deploy/vps/env/.env.production"
    echo "  BRANCH               Git branch. Default: main"
    echo "  SKIP_GIT_SYNC        Set true only when a trusted caller already synced the checkout"
    echo ""
    echo "Services: backend, hermes, celery-worker, celery-beat, nginx, redis"
}

ensure_project_exists() {
    if [ ! -d "$PROJECT_DIR/.git" ]; then
        error "Project repo not found at: $PROJECT_DIR"
        echo "  Clone the repo first:"
        echo "  sudo git clone https://github.com/wesship/supreme-ai-deployment-hub.git $PROJECT_DIR"
        exit 1
    fi
}

ensure_env_exists() {
    if [ ! -f "$ENV_FILE" ]; then
        if [ ! -f "$EXAMPLE_ENV" ]; then
            error "Environment template not found: $EXAMPLE_ENV"
            exit 1
        fi
        cp "$EXAMPLE_ENV" "$ENV_FILE"
        chmod 600 "$ENV_FILE"
        warn "Created environment file: $ENV_FILE"
        echo "  Edit it with real VPS-only secrets before deploying:"
        echo "  sudo nano $ENV_FILE"
        exit 2
    fi
    chmod 600 "$ENV_FILE"
}

validate_env() {
    if [ "$SKIP_VALIDATE" = true ]; then
        warn "Skipping production env validation (--skip-validate)"
        return
    fi
    if [ -f "$VALIDATE_SCRIPT" ]; then
        log "Validating production environment..."
        if ! bash "$VALIDATE_SCRIPT" "$ENV_FILE"; then
            error "Environment validation failed. Fix the issues above before deploying."
            exit 1
        fi
        success "Environment validation passed"
    else
        warn "validate-production-env.sh not found; skipping env validation"
    fi
}

ensure_dirs() {
    mkdir -p "${COMPOSE_DIR}/nginx/logs"
    mkdir -p "${COMPOSE_DIR}/ssl/certs"
    mkdir -p "${COMPOSE_DIR}/ssl/webroot"
    success "Volume mount directories ensured"
}

compose_cmd() {
    local cmd="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
    if [ "$WITH_MONITORING" = true ]; then
        cmd="$cmd -f $MONITORING_FILE"
    fi
    echo "$cmd"
}

wait_for_backend() {
    local max_attempts=24
    local attempt=0
    log "Waiting for backend health (up to 120 s)..."
    while [ $attempt -lt $max_attempts ]; do
        attempt=$((attempt + 1))
        STATUS=$(docker exec d3vonn-backend curl -sf http://localhost:8000/health/live 2>/dev/null || true)
        if echo "$STATUS" | grep -q '"status"'; then
            success "Backend is healthy after ${attempt}×5 s"
            return 0
        fi
        sleep 5
    done
    return 1
}

show_status() {
    ensure_project_exists
    ensure_env_exists

    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  D3VONN.IO — Deployment Status                             ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    cd "$COMPOSE_DIR"
    local COMPOSE_CMD
    COMPOSE_CMD=$(compose_cmd)

    echo "━━━ Container Status ━━━"
    $COMPOSE_CMD ps

    echo ""
    echo "━━━ Resource Usage ━━━"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
        $($COMPOSE_CMD ps -q 2>/dev/null) 2>/dev/null || \
        echo "  No containers running"

    echo ""
    echo "━━━ Health Checks ━━━"
    BACKEND_HEALTH=$(docker exec d3vonn-backend curl -sf http://localhost:8000/health/live 2>/dev/null || echo "UNREACHABLE")
    echo "  Backend:  ${BACKEND_HEALTH}"

    REDIS_HEALTH=$(docker exec d3vonn-redis redis-cli ping 2>/dev/null || echo "UNREACHABLE")
    echo "  Redis:    ${REDIS_HEALTH}"

    NGINX_HEALTH=$(curl -sf http://localhost/health 2>/dev/null || echo "UNREACHABLE")
    echo "  Nginx:    ${NGINX_HEALTH}"

    echo ""
    echo "━━━ Git Status ━━━"
    cd "$PROJECT_DIR"
    echo "  Branch: $(git branch --show-current)"
    echo "  Commit: $(git log --oneline -1)"
    echo "  Remote: $(git remote get-url origin)"
}

deploy() {
    ensure_project_exists
    ensure_env_exists
    validate_env

    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  D3VONN.IO — Deploying to Hostinger VPS                    ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    cd "$PROJECT_DIR"
    PREVIOUS_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "none")

    if [ "$SKIP_GIT_SYNC" = true ]; then
        log "Using trusted pre-synced checkout at $(git rev-parse --short HEAD)"
    else
        log "Pulling latest code from ${BRANCH}..."
        git fetch origin "$BRANCH"
        git checkout "$BRANCH"
        git reset --hard "origin/${BRANCH}"
        success "Code updated to $(git log --oneline -1)"
    fi

    echo "$PREVIOUS_COMMIT" > "${COMPOSE_DIR}/.rollback_commit"

    ensure_dirs

    cd "$COMPOSE_DIR"
    local COMPOSE_CMD
    COMPOSE_CMD=$(compose_cmd)

    log "Validating Docker Compose config..."
    $COMPOSE_CMD config >/tmp/d3vonn-compose.rendered.yml
    success "Compose validation OK"

    log "Building images..."
    if [ -n "$SERVICE" ]; then
        $COMPOSE_CMD build --pull "$SERVICE"
    else
        $COMPOSE_CMD build --pull
    fi
    success "Images built"

    log "Starting services..."
    if [ -n "$SERVICE" ]; then
        $COMPOSE_CMD up -d --force-recreate "$SERVICE"
    else
        $COMPOSE_CMD up -d --remove-orphans
    fi
    success "Services started"

    if ! wait_for_backend; then
        error "Backend health check failed after 120 s."
        echo ""
        echo "Collecting diagnostics..."
        docker logs --tail=50 d3vonn-backend 2>&1 || true
        echo ""
        warn "Run: sudo APP_DIR=$APP_DIR bash $0 --status"
        warn "Rollback if needed: sudo APP_DIR=$APP_DIR bash $0 --rollback"
        exit 1
    fi

    success "Deployment successful."
    echo ""
    show_status
}

rollback() {
    ensure_project_exists
    ensure_env_exists

    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  D3VONN.IO — Rolling Back                                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    cd "$PROJECT_DIR"

    ROLLBACK_COMMIT=$(cat "${COMPOSE_DIR}/.rollback_commit" 2>/dev/null || echo "")
    if [ -z "$ROLLBACK_COMMIT" ] || [ "$ROLLBACK_COMMIT" = "none" ]; then
        error "No rollback point available"
        exit 1
    fi

    log "Rolling back to commit: $ROLLBACK_COMMIT"
    git reset --hard "$ROLLBACK_COMMIT"

    ensure_dirs

    cd "$COMPOSE_DIR"
    local COMPOSE_CMD
    COMPOSE_CMD=$(compose_cmd)
    $COMPOSE_CMD up -d --force-recreate

    if ! wait_for_backend; then
        error "Rollback health check also failed. Manual intervention required."
        docker logs --tail=50 d3vonn-backend 2>&1 || true
        exit 1
    fi

    success "Rollback successful."
}

case $ACTION in
    deploy)   deploy ;;
    rollback) rollback ;;
    status)   show_status ;;
    help)     show_help ;;
esac
