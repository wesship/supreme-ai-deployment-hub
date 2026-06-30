#!/usr/bin/env bash
# =============================================================================
# Devonn.AI — Restore from Emergency Stop
# Clears the kill switch and restores stable (non-canary) operation.
# Does NOT re-enable canary — that requires a deliberate activate-c1.sh run.
# =============================================================================
set -euo pipefail

NAMESPACE="${DEVONN_NAMESPACE:-d3vonn-prod}"
CONTROL_PLANE_CM="d3vonn-runtime-control-plane"

log()  { echo "[restore] $*"; }

log "Restoring from emergency stop..."

# ── Step 1: Clear kill switch flags ───────────────────────────────────────────
kubectl patch configmap "$CONTROL_PLANE_CM" \
  -n "$NAMESPACE" \
  --type merge \
  -p '{
    "data": {
      "GLOBAL_EXECUTION_PAUSE": "false",
      "KILL_SWITCH_GLOBAL": "armed",
      "REPLAY_FREEZE_MODE": "false",
      "MEMORY_WRITE_MODE": "strict",
      "CANARY_ENABLED": "false",
      "CANARY_STAGE": "C0"
    }
  }'
log "Kill switch cleared."

# ── Step 2: Restore agent-executor replicas ───────────────────────────────────
log "Restoring agent-executor to 2 replicas..."
kubectl scale deployment agent-executor --replicas=2 -n "$NAMESPACE"
kubectl rollout status deployment/agent-executor -n "$NAMESPACE" --timeout=180s

# ── Step 3: Confirm restored state ────────────────────────────────────────────
PAUSE=$(kubectl get configmap "$CONTROL_PLANE_CM" -n "$NAMESPACE" \
  -o jsonpath='{.data.GLOBAL_EXECUTION_PAUSE}')
KS=$(kubectl get configmap "$CONTROL_PLANE_CM" -n "$NAMESPACE" \
  -o jsonpath='{.data.KILL_SWITCH_GLOBAL}')

echo ""
echo "✅ ============================================================"
echo "✅  SYSTEM RESTORED TO STABLE OPERATION"
echo "✅  GLOBAL_EXECUTION_PAUSE: $PAUSE"
echo "✅  KILL_SWITCH_GLOBAL:     $KS"
echo "✅  CANARY_ENABLED:         false (C0)"
echo "✅"
echo "✅  Investigate root cause before re-activating canary."
echo "✅ ============================================================"
