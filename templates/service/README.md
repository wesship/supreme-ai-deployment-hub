# D3VONN Golden Path: New Service Template

This template provides a production-ready scaffold for new services on the D3VONN platform.
All security, observability, and compliance requirements are pre-wired.

## Quick Start

```bash
# 1. Copy this template
cp -r templates/service my-new-service/

# 2. Replace placeholders
find my-new-service/ -type f | xargs sed -i 's/{{SERVICE_NAME}}/my-new-service/g'

# 3. Register with GitOps
cp my-new-service/gitops/*.yaml gitops/apps/my-new-service/

# 4. Open a PR — CI will validate security posture automatically
```

## What's Included

| Component | Implementation |
|-----------|---------------|
| Container | Distroless Python 3.12 (nonroot:65532) |
| Security | seccomp profile, all capabilities dropped, read-only rootfs |
| Observability | OpenTelemetry auto-instrumentation, OTLP export |
| Health checks | /health and /ready endpoints |
| Resource limits | 100m-1000m CPU, 256Mi-1Gi memory |
| GitOps | ArgoCD Application manifest pre-configured |
| Signing | Cosign keyless signing on every push |
| SBOM | CycloneDX SBOM generated on every release |
