#!/usr/bin/env bash
# Bootstrap namespaces with Pod Security Admission labels.
# Idempotent — safe to re-run.
set -euo pipefail

echo "==> Applying namespaces with PSA labels"
kubectl apply -f k8s/base/namespace.yaml

echo "==> Ensuring PSA labels on d3vonn (restricted)"
kubectl label namespace d3vonn \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/warn=restricted \
  pod-security.kubernetes.io/audit=restricted \
  --overwrite

echo "==> Ensuring PSA labels on observability (baseline)"
kubectl label namespace observability \
  pod-security.kubernetes.io/enforce=baseline \
  pod-security.kubernetes.io/warn=restricted \
  --overwrite

echo "==> Ensuring PSA labels on security (privileged — Falco needs host access)"
kubectl label namespace security \
  pod-security.kubernetes.io/enforce=privileged \
  pod-security.kubernetes.io/warn=privileged \
  --overwrite

echo "==> Bootstrap complete."
