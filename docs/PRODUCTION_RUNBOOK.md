# Devonn.AI Production Runbook

**Version:** 2.0.0
**Last Updated:** 2026-05-16

This runbook provides step-by-step procedures for operating, monitoring, and recovering the Devonn.AI platform in production.

---

## 1. Deployment

### Standard Deployment (via CI/CD)

All deployments to production are triggered automatically when a commit is merged into `main`. The `deploy.yml` workflow handles Vercel deployment for the frontend. Kubernetes workloads are updated via the `eks-deploy-oidc.yml` workflow using OIDC-based AWS authentication.

### Manual Deployment (Emergency)

If CI/CD is unavailable, deploy manually using the following steps:

```bash
# Frontend
vercel --prod

# Backend (Kubernetes)
kubectl set image deployment/devonn-backend backend=<ECR_URI>:<TAG> -n devonn-ai
kubectl rollout status deployment/devonn-backend -n devonn-ai
```

### Rollback

Use the `scripts/rollback.sh` script to roll back to the previous deployment:

```bash
bash scripts/rollback.sh <deployment-name> <namespace>
# Example:
bash scripts/rollback.sh devonn-backend devonn-ai
```

---

## 2. Health Checks

| Endpoint | Expected Response | Purpose |
|----------|------------------|---------|
| `GET /health` | `{"status": "ok"}` | Liveness probe |
| `GET /ready` | `{"status": "ready"}` | Readiness probe |
| `GET /api/v1/health` | `{"api": "v1", "status": "ok"}` | API v1 health |

Check all pods are running:

```bash
kubectl get pods -n devonn-ai
kubectl describe pod <pod-name> -n devonn-ai
```

---

## 3. Monitoring

The Grafana dashboard is available at the configured Grafana URL. Key metrics to monitor:

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| API error rate (5xx) | > 1% over 5 min | Check backend logs, roll back if needed |
| API p99 latency | > 2000ms | Scale up backend pods |
| Redis memory usage | > 80% | Flush expired keys or scale Redis |
| DB connection pool | > 90% utilisation | Increase `DB_POOL_MAX_SIZE` |
| Pod restart count | > 3 in 10 min | Check pod logs for crash loop |

View logs with Loki:

```bash
# Backend logs
kubectl logs -f deployment/devonn-backend -n devonn-ai

# Worker logs
kubectl logs -f deployment/devonn-worker -n devonn-ai
```

---

## 4. Incident Response

### High Error Rate

1. Check Sentry for the error details and stack trace.
2. Check backend logs: `kubectl logs -f deployment/devonn-backend -n devonn-ai`.
3. If a recent deployment caused the issue, roll back immediately using `scripts/rollback.sh`.
4. If the issue is in the database, check Supabase logs and connection pool health.

### Database Connection Failure

1. Verify the database is reachable: `psql $DATABASE_URL -c "SELECT 1;"`.
2. Check the External Secrets Operator has synced the latest credentials: `kubectl get externalsecret -n devonn-ai`.
3. Restart the backend pods: `kubectl rollout restart deployment/devonn-backend -n devonn-ai`.

### Redis Failure

1. Check Redis pod status: `kubectl get pods -n devonn-ai -l app=redis`.
2. If Redis is down, the task queue and rate limiting will be degraded but the API will continue to serve requests.
3. Restart Redis: `kubectl rollout restart deployment/redis -n devonn-ai`.

---

## 5. Secrets Rotation

Rotate secrets every 90 days using the automated script:

```bash
bash scripts/rotate_secrets.sh
```

This script rotates AWS IAM access keys and generates a new JWT secret. After rotation, update the corresponding GitHub Secrets and Kubernetes Secrets.

For Supabase keys, rotate manually in the Supabase Dashboard under **Settings → API**.

---

## 6. Database Migrations

Apply pending Supabase migrations:

```bash
supabase db push
```

Always run migrations during a maintenance window and verify with:

```bash
supabase db diff
```

---

## 7. Scaling

Scale backend pods horizontally:

```bash
kubectl scale deployment devonn-backend --replicas=5 -n devonn-ai
```

The Horizontal Pod Autoscaler (HPA) is configured to scale automatically between 2 and 10 replicas based on CPU utilisation (target: 70%).

---

## 8. Backup & Recovery

Database backups are managed by Supabase (daily automated backups with 7-day retention). For manual backups, use:

```bash
bash scripts/db_backup.sh
```

Backups are stored in the configured AWS S3 bucket.

---

## Related Documents

- [Architecture Overview](./ARCHITECTURE.md)
- [Disaster Recovery Plan](./DISASTER_RECOVERY_PLAN.md)
- [Common Issues Runbook](./runbooks/common_issues.md)
