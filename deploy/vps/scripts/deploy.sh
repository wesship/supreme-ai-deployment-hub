#!/bin/bash
# =============================================================================
# D3VONN.IO — Deployment Script
# =============================================================================
# Usage:
#   ./deploy.sh                  # Deploy all services
#   ./deploy.sh --service backend  # Deploy specific service
#   ./deploy.sh --rollback       # Rollback to previous version
#   ./deploy.sh --status         # Show deployment status
# =============================================================================

set -euo pipefail

PROJECT_DIR="/opt/d3vonn"
COMPOSE_DIR="${PROJECT_DIR}/deploy/vps"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
MONITORING_FILE="${COMPOSE_DIR}/docker-compose.monitoring.yml"
ENV_FILE="${COMPOSE_DIR}/.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "[$(date -Iseconds)] $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC} $1"; }
error() { echo -e "${RED}❌${NC} $1"; }

# Parse arguments
ACTION="deploy"
SERVICE=""
WITH_MONITORING=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --rollback) ACTION="rollback"; shift ;;
        --status) ACTION="status"; shift ;;
        --service) SERVICE="$2"; shift 2 ;;
        --with-monitoring) WITH_MONITORING=true; shift ;;
        --help) ACTION="help"; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ── Help ─────────────────────────────────────────────────────────────────────
show_help() {
    echo "D3VONN.IO Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --service NAME       Deploy a specific service only"
    echo "  --with-monitoring    Include monitoring stack"
    echo "  --rollback           Rollback to previous version"
    echo "  --status             Show current deployment status"
    echo "  --help               Show this help message"
    echo ""
    echo "Services: backend, hermes, celery-worker, security-agent,"
    echo "          opportunity-agent, knowledge-graph, nginx, redis"
}

# ── Status ───────────────────────────────────────────────────────────────────
show_status() {
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  D3VONN.IO — Deployment Status                             ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    cd "$COMPOSE_DIR"

    echo "━━━ Container Status ━━━"
    docker compose -f "$COMPOSE_FILE" ps

    echo ""
    echo "━━━ Resource Usage ━━━"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
        $(docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null) 2>/dev/null || \
        echo "  No containers running"

    echo ""
    echo "━━━ Health Checks ━━━"
    # Backend health
    BACKEND_HEALTH=$(docker exec d3vonn-backend curl -sf http://localhost:8000/health 2>/dev/null || echo "UNREACHABLE")
    echo "  Backend: ${BACKEND_HEALTH}"

    # Redis health
    REDIS_HEALTH=$(docker exec d3vonn-redis redis-cli ping 2>/dev/null || echo "UNREACHABLE")
    echo "  Redis:   ${REDIS_HEALTH}"

    # Nginx health
    NGINX_HEALTH=$(curl -sf http://localhost/health 2>/dev/null || echo "UNREACHABLE")
    echo "  Nginx:   ${NGINX_HEALTH}"

    echo ""
    echo "━━━ Git Status ━━━"
    cd "$PROJECT_DIR"
    echo "  Branch: $(git branch --show-current)"
    echo "  Commit: $(git log --oneline -1)"
    echo "  Remote: $(git remote get-url origin)"
}

# ── Deploy ───────────────────────────────────────────────────────────────────
deploy() {
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  D3VONN.IO — Deploying                                     ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    cd "$PROJECT_DIR"

    # Check .env exists
    if [ ! -f "$ENV_FILE" ]; then
        error "Environment file not found: $ENV_FILE"
        echo "  Copy the template: cp ${COMPOSE_DIR}/env/.env.example ${ENV_FILE}"
        exit 1
    fi

    # Pull latest code
    log "Pulling latest code..."
    git fetch origin main
    git reset --hard origin/main
    success "Code updated to $(git log --oneline -1)"

    # Save current state for rollback
    PREVIOUS_COMMIT=$(git rev-parse HEAD~1 2>/dev/null || echo "none")
    echo "$PREVIOUS_COMMIT" > "${COMPOSE_DIR}/.rollback_commit"

    cd "$COMPOSE_DIR"

    # Build compose command
    COMPOSE_CMD="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
    if [ "$WITH_MONITORING" = true ]; then
        COMPOSE_CMD="$COMPOSE_CMD -f $MONITORING_FILE"
    fi

    # Pull/build images
    log "Building images..."
    if [ -n "$SERVICE" ]; then
        $COMPOSE_CMD build "$SERVICE"
    else
        $COMPOSE_CMD build
    fi
    success "Images built"

    # Deploy
    log "Starting services..."
    if [ -n "$SERVICE" ]; then
        $COMPOSE_CMD up -d --force-recreate "$SERVICE"
    else
        $COMPOSE_CMD up -d --remove-orphans
    fi
    success "Services started"

    # Wait for health checks
    log "Waiting for health checks (30s)..."
    sleep 30

    # Verify
    BACKEND_HEALTH=$(docker exec d3vonn-backend curl -sf http://localhost:8000/health 2>/dev/null || echo "FAILED")
    if [ "$BACKEND_HEALTH" = "FAILED" ]; then
        error "Backend health check failed!"
        warn "Consider running: ./deploy.sh --rollback"
        exit 1
    fi

    success "Deployment successful!"
    echo ""
    show_status
}

# ── Rollback ─────────────────────────────────────────────────────────────────
rollback() {
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

    cd "$COMPOSE_DIR"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate
    
    sleep 15

    BACKEND_HEALTH=$(docker exec d3vonn-backend curl -sf http://localhost:8000/health 2>/dev/null || echo "FAILED")
    if [ "$BACKEND_HEALTH" = "FAILED" ]; then
        error "Rollback health check also failed! Manual intervention required."
        exit 1
    fi

    success "Rollback successful!"
}

# ── Execute ──────────────────────────────────────────────────────────────────
case $ACTION in
    deploy) deploy ;;
    rollback) rollback ;;
    status) show_status ;;
    help) show_help ;;
esac
