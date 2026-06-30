#!/usr/bin/env bash
# =============================================================================
# Devonn.AI — Emergency Global Kill Switch
# Instantly halts all canary traffic and pauses agent execution.
# Memory and trace state are preserved. Replay ingestion is frozen.
#
# Run this immediately if any of the following are observed:
#   - Governance p95 latency > 200ms
#   - Error rate > 3x baseline
#   - Circuit breaker open on any service
#   - Rollback engine recommends "automatic" rollback
# =============================================================================
set -euo pipefail

NAMESPACE="${DEVONN_NAMESPACE:-d3vonn-prod}"
CONTROL_PLANE_CM="d3vonn-runtime-control-plane"

log()  { echo "[emergency-stop] $*"; }

echo ""
echo "🚨 ============================================================"
echo "🚨  DEVONN.AI EMERGENCY STOP INITIATED"
echo "🚨 ============================================================"
echo ""

# ── Step 1: Patch ConfigMap — instant effect on next request ──────────────────
log "Patching control plane to halt state..."
kubectl patch configmap "$CONTROL_PLANE_CM" \
  -n "$NAMESPACE" \
  --type merge \
  -p '{
    "data": {
      "GLOBAL_EXECUTION_PAUSE": "true",
      "CANARY_ENABLED": "false",
      "CANARY_STAGE": "C0",
      "CANARY_PERCENTAGE": "0",
      "KILL_SWITCH_GLOBAL": "triggered",
      "REPLAY_FREEZE_MODE": "true",
      "MEMORY_WRITE_MODE": "readonly"
    }
  }'
log "ConfigMap patched — new requests will be rejected immediately."

# ── Step 2: Scale agent-executor to 0 to drain active executions ──────────────
log "Scaling agent-executor to 0 replicas..."
kubectl scale deployment agent-executor --replicas=0 -n "$NAMESPACE"

# ── Step 3: Preserve memory and trace state (do NOT delete PVCs) ──────────────
log "Memory and trace PVCs preserved — no data deleted."

# ── Step 4: Confirm halt state ────────────────────────────────────────────────
log "Verifying halt state..."
PAUSE=$(kubectl get configmap "$CONTROL_PLANE_CM" -n "$NAMESPACE" \
  -o jsonpath='{.data.GLOBAL_EXECUTION_PAUSE}')
CANARY=$(kubectl get configmap "$CONTROL_PLANE_CM" -n "$NAMESPACE" \
  -o jsonpath='{.data.CANARY_ENABLED}')
KS=$(kubectl get configmap "$CONTROL_PLANE_CM" -n "$NAMESPACE" \
  -o jsonpath='{.data.KILL_SWITCH_GLOBAL}')

echo ""
echo "🛑 ============================================================"
echo "🛑  SYSTEM HALTED"
echo "🛑  GLOBAL_EXECUTION_PAUSE: $PAUSE"
echo "🛑  CANARY_ENABLED:         $CANARY"
echo "🛑  KILL_SWITCH_GLOBAL:     $KS"
echo "🛑"
echo "🛑  To restore: run scripts/canary/restore-from-emergency.sh"
echo "🛑 ============================================================"
