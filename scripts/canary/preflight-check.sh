#!/usr/bin/env bash
# =============================================================================
# Devonn.AI — Pre-Flight Validation Gate
# Run this BEFORE activating C1 canary traffic.
# All checks must pass (exit 0) before proceeding.
# =============================================================================
set -euo pipefail

NAMESPACE="${DEVONN_NAMESPACE:-d3vonn-prod}"
CONTROL_PLANE_CM="d3vonn-runtime-control-plane"
REQUIRED_DEPLOYMENTS=("mcp-gateway" "agent-executor" "governance-engine" "observability-collector")
FAILED=0

log()    { echo "[preflight] $*"; }
warn()   { echo "[preflight] WARN: $*" >&2; }
fail()   { echo "[preflight] FAIL: $*" >&2; FAILED=1; }
pass()   { echo "[preflight] PASS: $*"; }

# ── 1. Namespace exists ────────────────────────────────────────────────────────
log "Checking namespace '$NAMESPACE'..."
if kubectl get namespace "$NAMESPACE" &>/dev/null; then
  pass "Namespace '$NAMESPACE' exists"
else
  fail "Namespace '$NAMESPACE' not found — run: kubectl create namespace $NAMESPACE"
fi

# ── 2. Control plane ConfigMap is applied ─────────────────────────────────────
log "Checking control plane ConfigMap..."
if kubectl get configmap "$CONTROL_PLANE_CM" -n "$NAMESPACE" &>/dev/null; then
  pass "ConfigMap '$CONTROL_PLANE_CM' is present"
else
  fail "ConfigMap '$CONTROL_PLANE_CM' not found — run: kubectl apply -f k8s/production/control-plane/d3vonn-control-plane.yaml"
fi

# ── 3. Verify GLOBAL_EXECUTION_PAUSE is false ─────────────────────────────────
log "Checking kill-switch state..."
PAUSE_VALUE=$(kubectl get configmap "$CONTROL_PLANE_CM" -n "$NAMESPACE" \
  -o jsonpath='{.data.GLOBAL_EXECUTION_PAUSE}' 2>/dev/null || echo "unknown")
if [[ "$PAUSE_VALUE" == "false" ]]; then
  pass "GLOBAL_EXECUTION_PAUSE=false (safe to proceed)"
else
  fail "GLOBAL_EXECUTION_PAUSE=$PAUSE_VALUE — must be 'false' before activating C1"
fi

# ── 4. All required deployments are running ───────────────────────────────────
log "Checking required deployments..."
for dep in "${REQUIRED_DEPLOYMENTS[@]}"; do
  READY=$(kubectl get deployment "$dep" -n "$NAMESPACE" \
    -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
  DESIRED=$(kubectl get deployment "$dep" -n "$NAMESPACE" \
    -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "1")
  if [[ "$READY" == "$DESIRED" && "$READY" != "0" ]]; then
    pass "Deployment '$dep' is ready ($READY/$DESIRED)"
  else
    fail "Deployment '$dep' not ready ($READY/$DESIRED)"
  fi
done

# ── 5. No CrashLoopBackOff pods ───────────────────────────────────────────────
log "Checking for CrashLoopBackOff pods..."
CRASH_PODS=$(kubectl get pods -n "$NAMESPACE" \
  --field-selector=status.phase!=Succeeded \
  -o jsonpath='{range .items[*]}{.metadata.name}{" "}{range .status.containerStatuses[*]}{.state.waiting.reason}{" "}{end}{"\n"}{end}' 2>/dev/null \
  | grep -c "CrashLoopBackOff" || true)
if [[ "$CRASH_PODS" == "0" ]]; then
  pass "No CrashLoopBackOff pods detected"
else
  fail "$CRASH_PODS pod(s) in CrashLoopBackOff state"
fi

# ── 6. HPA is configured ──────────────────────────────────────────────────────
log "Checking HPA configuration..."
HPA_COUNT=$(kubectl get hpa -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l || echo "0")
if [[ "$HPA_COUNT" -gt 0 ]]; then
  pass "HPA configured ($HPA_COUNT entries)"
else
  warn "No HPA found in namespace '$NAMESPACE' — consider adding autoscaling before C2"
fi

# ── 7. Node resource pressure ─────────────────────────────────────────────────
log "Checking node resource pressure..."
PRESSURE_NODES=$(kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{" "}{range .status.conditions[*]}{.type}={.status}{" "}{end}{"\n"}{end}' 2>/dev/null \
  | grep -c "MemoryPressure=True\|DiskPressure=True\|PIDPressure=True" || true)
if [[ "$PRESSURE_NODES" == "0" ]]; then
  pass "No node resource pressure detected"
else
  fail "$PRESSURE_NODES node(s) under resource pressure"
fi

# ── Result ────────────────────────────────────────────────────────────────────
echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo "============================================================"
  echo " PRE-FLIGHT PASSED — Safe to run activate-c1.sh"
  echo "============================================================"
  exit 0
else
  echo "============================================================"
  echo " PRE-FLIGHT FAILED — Resolve issues above before proceeding"
  echo "============================================================"
  exit 1
fi
