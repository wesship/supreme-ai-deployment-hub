# Devonn.AI Production Deployment Runbook

**Author:** Manus AI
**Version:** 1.0.0
**Target:** Autonomous Runtime Execution Layer (Waves 27-31)

This runbook defines the operational procedures for deploying the Devonn.AI runtime execution layer to production. It covers the environment promotion sequence, the canary rollout strategy, and the emergency rollback procedure.

## 1. Service Decomposition Map

The autonomous runtime is decomposed into four independently scalable Kubernetes deployments within the `devonn-prod` namespace:

| Service | Responsibility | Scaling Trigger | Persistence |
|---------|----------------|-----------------|-------------|
| **MCP Gateway** | Tool routing, API gateway, registry resolution | CPU (65%) / HTTP req/sec | Stateless |
| **Agent Executor** | ReAct execution loops, state management | CPU (60%) / Mem (70%) | Redis Cache |
| **Governance Engine** | Arbitration, policy resolution, access control | Queue depth / CPU | Policy Store |
| **Observability Collector**| Trace aggregation, health scoring, telemetry | Network I/O / Mem | Buffer Volume |

## 2. Environment Promotion Sequence

All deployments must follow a strict three-stage promotion sequence enforced by the GitOps pipeline (ArgoCD).

### Stage 1: Integration (Staging)
1. PR merged to `main` triggers container builds.
2. Image tags are updated in `config/staging/values.yaml`.
3. ArgoCD syncs the `devonn-staging` namespace.
4. **Validation:** The full `stress-validation` suite (LS-1 through LS-6) is executed against the staging environment.

### Stage 2: Canary Rollout (Production)
1. If staging validation passes, release manager approves promotion to canary.
2. Image tags are updated in `config/canary/values.yaml`.
3. ArgoCD deploys the new version alongside the existing production version, receiving 5% of traffic via ingress weighting.
4. **Validation:** The `SystemHealthModel` (Wave 31) monitors the canary pods for 15 minutes. Drift must remain <1%, and error rates must not exceed the baseline.

### Stage 3: Full Production Promotion
1. If the canary health score remains nominal for the observation window, the ingress weight is automatically stepped up: 25% → 50% → 100%.
2. The old deployment is scaled down to 0 but retained in the ReplicaSet history for 24 hours.

## 3. Canary Rollout Configuration

The canary rollout is managed via an NGINX Ingress configuration. The API gateway routes a percentage of traffic based on the `canary-weight` annotation.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-gateway-canary
  namespace: devonn-prod
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "5"
```

## 4. Emergency Rollback Procedure

If a severe degradation is detected (e.g., arbitration deadlock, memory leak, or split-brain partition), the deployment must be immediately rolled back to the last known good state.

### Automated Rollback (GitOps)
ArgoCD is configured with auto-rollback if the `SystemHealthModel` reports a critical failure during the canary phase.

### Manual Rollback via Git Revert
If a failure occurs after full promotion, the primary rollback mechanism is a Git revert of the manifest repository:

1. Identify the offending commit in the manifest repository.
2. Revert the commit: `git revert <commit-sha>`
3. Push to `main`: `git push origin main`
4. ArgoCD will automatically detect the drift and sync the cluster back to the previous image tags.

### Emergency Imperative Rollback (Break-Glass)
If GitOps reconciliation is blocked, cluster administrators can perform an imperative rollback using `kubectl`:

```bash
# View deployment history
kubectl rollout history deployment/agent-executor -n devonn-prod

# Undo the deployment to the previous revision
kubectl rollout undo deployment/agent-executor -n devonn-prod

# Verify the rollback status
kubectl rollout status deployment/agent-executor -n devonn-prod
```

## 5. Pre-Deployment Checklist

Before approving a production promotion, verify the following:
- [ ] The `Operational Stress Gate` passed in the CI pipeline.
- [ ] The `Governance Arbitration Gate` passed (no deadlocks).
- [ ] No active alerts in the `Observability Collector`.
- [ ] Redis and Policy Store external secrets are properly synced.
- [ ] The OpenAPI 3.1 gateway specification has been published to the developer portal.
