#!/bin/bash
# =============================================================================
# D3VONN.IO — VPS Health Check Script
# =============================================================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Checking VPS service health..."

check_service() {
    local name=$1
    local cmd=$2
    if eval "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $name is failing"
        return 1
    fi
}

FAILED=0

# Core services
check_service "Nginx" "curl -sf http://localhost/health" || FAILED=1
check_service "Backend API live" "docker exec d3vonn-backend curl -sf http://localhost:8000/health/live" || FAILED=1
check_service "Backend API ready" "docker exec d3vonn-backend curl -sf http://localhost:8000/health/ready" || FAILED=1
check_service "Redis" "docker exec d3vonn-redis redis-cli ping | grep -q PONG" || FAILED=1
check_service "Hermes" "docker inspect --format='{{.State.Running}}' d3vonn-hermes 2>/dev/null | grep -q true" || FAILED=1

# Worker services
check_service "Celery Worker" "docker inspect --format='{{.State.Running}}' d3vonn-celery-worker 2>/dev/null | grep -q true" || FAILED=1
check_service "Celery Beat" "docker inspect --format='{{.State.Running}}' d3vonn-celery-beat 2>/dev/null | grep -q true" || FAILED=1

# Agent services
check_service "Security Agent" "docker inspect --format='{{.State.Running}}' d3vonn-security-agent 2>/dev/null | grep -q true" || FAILED=1
check_service "Opportunity Agent" "docker inspect --format='{{.State.Running}}' d3vonn-opportunity-agent 2>/dev/null | grep -q true" || FAILED=1
check_service "Knowledge Graph" "docker inspect --format='{{.State.Running}}' d3vonn-knowledge-graph 2>/dev/null | grep -q true" || FAILED=1

if [ $FAILED -eq 1 ]; then
    echo -e "\n${RED}One or more services are failing.${NC}"
    exit 1
else
    echo -e "\n${GREEN}All services are healthy.${NC}"
    exit 0
fi
