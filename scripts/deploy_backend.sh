#!/usr/bin/env bash
# scripts/deploy_backend.sh — Devonn.AI Backend Deployment Script
#
# Supports two deployment targets:
#   1. render  — Render.com (fastest path to staging, no K8s needed)
#   2. eks     — AWS EKS (production Kubernetes)
#   3. docker  — Local Docker Compose (development)
#
# Usage:
#   bash scripts/deploy_backend.sh --target render --env staging
#   bash scripts/deploy_backend.sh --target eks    --env production
#   bash scripts/deploy_backend.sh --target docker --env local

set -euo pipefail

TARGET="render"
ENV="staging"
IMAGE_TAG="${GITHUB_SHA:-latest}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --env)    ENV="$2";    shift 2 ;;
    --tag)    IMAGE_TAG="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

log() { echo "[deploy_backend] [$TARGET/$ENV] $*"; }
die() { echo "[deploy_backend] ERROR: $*" >&2; exit 1; }

log "Deploying backend — target: $TARGET, env: $ENV, tag: $IMAGE_TAG"
echo ""

# ── Render.com deployment ──────────────────────────────────────────────────
deploy_render() {
  command -v curl >/dev/null 2>&1 || die "curl not installed"
  [ -z "${RENDER_API_KEY:-}" ]   && die "RENDER_API_KEY not set"
  [ -z "${RENDER_SERVICE_ID:-}" ] && die "RENDER_SERVICE_ID not set"

  log "Triggering Render.com deploy for service: $RENDER_SERVICE_ID"
  RESPONSE=$(curl -s -X POST \
    "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"clearCache": false}')

  DEPLOY_ID=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('deploy',{}).get('id','unknown'))" 2>/dev/null)
  log "Deploy triggered. ID: $DEPLOY_ID"
  log "Monitor at: https://dashboard.render.com/web/$RENDER_SERVICE_ID/deploys/$DEPLOY_ID"
}

# ── AWS EKS deployment ─────────────────────────────────────────────────────
deploy_eks() {
  command -v kubectl >/dev/null 2>&1 || die "kubectl not installed"
  command -v aws     >/dev/null 2>&1 || die "AWS CLI not installed"
  [ -z "${ECR_REGISTRY:-}" ]     && die "ECR_REGISTRY not set"
  [ -z "${EKS_CLUSTER_NAME:-}" ] && die "EKS_CLUSTER_NAME not set"
  [ -z "${AWS_REGION:-}" ]       && die "AWS_REGION not set"

  ECR_IMAGE="$ECR_REGISTRY/d3vonn-backend:$IMAGE_TAG"

  log "Building and pushing Docker image: $ECR_IMAGE"
  aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$ECR_REGISTRY"
  docker build -t "$ECR_IMAGE" -f backend/Dockerfile .
  docker push "$ECR_IMAGE"

  log "Updating kubeconfig for cluster: $EKS_CLUSTER_NAME"
  aws eks update-kubeconfig --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION"

  log "Applying K8s manifests..."
  kubectl apply -f k8s/namespace.yaml
  kubectl apply -f k8s/base/
  kubectl set image deployment/d3vonn-backend \
    backend="$ECR_IMAGE" -n d3vonn

  log "Waiting for rollout..."
  kubectl rollout status deployment/d3vonn-backend -n d3vonn --timeout=300s

  log "✓ EKS deployment complete."
  kubectl get pods -n d3vonn -l app=d3vonn-backend
}

# ── Docker Compose (local) ─────────────────────────────────────────────────
deploy_docker() {
  command -v docker >/dev/null 2>&1 || die "Docker not installed"
  log "Starting local Docker Compose stack..."
  docker compose -f docker-compose.yml up -d --build
  log "✓ Local stack running. Backend: http://localhost:8000"
  log "  API docs: http://localhost:8000/api/docs"
}

case "$TARGET" in
  render) deploy_render ;;
  eks)    deploy_eks    ;;
  docker) deploy_docker ;;
  *) die "Unknown target: $TARGET. Use: render, eks, or docker" ;;
esac
