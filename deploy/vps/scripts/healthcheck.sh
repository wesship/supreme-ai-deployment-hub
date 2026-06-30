#!/bin/bash
# =============================================================================
# D3VONN.IO — Health Check Script
# =============================================================================
# Checks all services and reports status. Can be used with uptime monitors.
# Exit code 0 = all healthy, 1 = one or more services unhealthy
# =============================================================================

set -uo pipefail

HEALTHY=true

check_service() {
    local name="$1"
    local check_cmd="$2"
    
    if eval "$check_cmd" &>/dev/null; then
        echo "  ✓ ${name}: healthy"
    else
        echo "  ✗ ${name}: UNHEALTHY"
        HEALTHY=false
    fi
}

echo "D3VONN.IO Health Check — $(date -Iseconds)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Core services
check_service "Nginx" "curl -sf http://localhost/health"
check_service "Backend API" "docker exec d3vonn-backend curl -sf http://localhost:8000/health"
check_service "Redis" "docker exec d3vonn-redis redis-cli ping"
check_service "Hermes" "docker inspect --format='{{.State.Health.Status}}' d3vonn-hermes 2>/dev/null | grep -q healthy"

# Worker services
check_service "Celery Worker" "docker inspect --format='{{.State.Running}}' d3vonn-celery-worker 2>/dev/null | grep -q true"
check_service "Celery Beat" "docker inspect --format='{{.State.Running}}' d3vonn-celery-beat 2>/dev/null | grep -q true"

# Agent services
check_service "Security Agent" "docker inspect --format='{{.State.Running}}' d3vonn-security-agent 2>/dev/null | grep -q true"
check_service "Opportunity Agent" "docker inspect --format='{{.State.Running}}' d3vonn-opportunity-agent 2>/dev/null | grep -q true"
check_service "Knowledge Graph" "docker inspect --format='{{.State.Running}}' d3vonn-knowledge-graph 2>/dev/null | grep -q true"

echo ""

# System resources
echo "━━━ System Resources ━━━"
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100}')
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}')

echo "  CPU:  ${CPU_USAGE}%"
echo "  RAM:  ${MEM_USAGE}%"
echo "  Disk: ${DISK_USAGE}"

# Check thresholds
MEM_INT=$(echo "$MEM_USAGE" | cut -d'.' -f1)
if [ "$MEM_INT" -gt 90 ]; then
    echo "  ⚠️  Memory usage critical!"
    HEALTHY=false
fi

echo ""
if [ "$HEALTHY" = true ]; then
    echo "✅ All services healthy"
    exit 0
else
    echo "❌ One or more services unhealthy"
    exit 1
fi
