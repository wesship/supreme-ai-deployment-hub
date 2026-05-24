#!/usr/bin/env bash
# =============================================================================
# Devonn.AI — Canary C1 Activation Script
# Activates 0.5% canary traffic routing with all P0 safety systems enabled.
#
# PREREQUISITES: Run preflight-check.sh first and confirm all checks pass.
# =============================================================================
set -euo pipefail

NAMESPACE="${DEVONN_NAMESPACE:-devonn-prod}"
CONTROL_PLANE_CM="devonn-runtime-control-plane"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { echo "[activate-c1] $*"; }
fail() { echo "[activate-c1] ERROR: $*" >&2; exit 1; }

# ── Guard: must run preflight first ───────────────────────────────────────────
log "Running pre-flight validation..."
if ! bash "$SCRIPT_DIR/preflight-check.sh"; then
  fail "Pre-flight checks failed. Resolve all issues before activating C1."
fi

# ── Guard: confirm current stage is C0 ───────────────────────────────────────
CURRENT_STAGE=$(kubectl get configmap "$CONTROL_PLANE_CM" -n "$NAMESPACE" \
  -o jsonpath='{.data.CANARY_STAGE}' 2>/dev/null || echo "unknown")
if [[ "$CURRENT_STAGE" != "C0" ]]; then
  fail "Current canary stage is '$CURRENT_STAGE', not C0. Cannot activate C1."
fi

log "Current stage: C0 — proceeding to activate C1 at 0.5%"

# ── Step 1: Apply the control plane ConfigMap ─────────────────────────────────
log "Applying control plane ConfigMap..."
kubectl apply -f "$SCRIPT_DIR/../../k8s/production/control-plane/devonn-control-plane.yaml"

# ── Step 2: Patch to C1 state ─────────────────────────────────────────────────
log "Patching ConfigMap to C1 (0.5% canary traffic)..."
kubectl patch configmap "$CONTROL_PLANE_CM" \
  -n "$NAMESPACE" \
  --type merge \
  -p '{
    "data": {
      "CANARY_ENABLED": "true",
      "CANARY_PERCENTAGE": "0.5",
      "CANARY_STAGE": "C1",
      "GLOBAL_EXECUTION_PAUSE": "false",
      "KILL_SWITCH_GLOBAL": "armed",
      "BLAST_RADIUS_MODE": "strict",
      "GOVERNANCE_MODE": "enforcing",
      "FAILURE_CONTAINMENT": "enabled",
      "AUTO_ROLLBACK": "armed"
    }
  }'

# ── Step 3: Rolling restart of all runtime services ───────────────────────────
log "Initiating rolling restart of runtime services..."
for dep in mcp-gateway agent-executor governance-engine observability-collector; do
  log "  Restarting $dep..."
  kubectl rollout restart deployment/"$dep" -n "$NAMESPACE"
done

# ── Step 4: Wait for rollouts to complete ─────────────────────────────────────
log "Waiting for rollouts to complete..."
for dep in mcp-gateway agent-executor governance-engine observability-collector; do
  log "  Waiting for $dep..."
  kubectl rollout status deployment/"$dep" -n "$NAMESPACE" --timeout=300s
done

# ── Step 5: Post-activation verification ──────────────────────────────────────
log "Verifying post-activation state..."
CANARY_ENABLED=$(kubectl get configmap "$CONTROL_PLANE_CM" -n "$NAMESPACE" \
  -o jsonpath='{.data.CANARY_ENABLED}')
CANARY_STAGE=$(kubectl get configmap "$CONTROL_PLANE_CM" -n "$NAMESPACE" \
  -o jsonpath='{.data.CANARY_STAGE}')
CANARY_PCT=$(kubectl get configmap "$CONTROL_PLANE_CM" -n "$NAMESPACE" \
  -o jsonpath='{.data.CANARY_PERCENTAGE}')

echo ""
echo "============================================================"
echo " C1 CANARY ACTIVATION COMPLETE"
echo "  CANARY_ENABLED:    $CANARY_ENABLED"
echo "  CANARY_STAGE:      $CANARY_STAGE"
echo "  CANARY_PERCENTAGE: $CANARY_PCT%"
echo "  GOVERNANCE_MODE:   enforcing"
echo "  BLAST_RADIUS:      strict"
echo "  AUTO_ROLLBACK:     armed"
echo ""
echo " Monitor governance latency and error rates for 30 minutes."
echo " Run emergency-stop.sh immediately if anomalies are detected."
echo "============================================================"
