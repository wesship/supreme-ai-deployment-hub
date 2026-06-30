# D3VONN Disaster Recovery Runbook

This runbook defines the recovery procedures for all critical failure scenarios in the D3VONN production environment. It supersedes the basic `deployment_runbook.md` with structured RTO/RPO targets and step-by-step recovery procedures.

## Recovery Objectives

| Tier | Scenario | RTO Target | RPO Target |
| :--- | :--- | :--- | :--- |
| **Tier 1** | Single pod crash | < 2 minutes | 0 (stateless) |
| **Tier 2** | Full EKS node failure | < 10 minutes | 0 (stateless) |
| **Tier 3** | Database corruption or accidental deletion | < 30 minutes | < 1 hour |
| **Tier 4** | Full region failure (AWS us-east-1 outage) | < 4 hours | < 1 hour |
| **Tier 5** | Complete account compromise | < 24 hours | < 24 hours |

---

## Scenario 1: Single Pod Crash (Tier 1)

This is handled automatically by Kubernetes. No manual action is required unless the pod enters a crash loop.

**Verify auto-recovery:**
```bash
kubectl get pods -n d3vonn -w
kubectl rollout status deployment/d3vonn-backend -n d3vonn
```

**If crash-looping (more than 5 restarts):**
```bash
# Check logs from the crashed container
kubectl logs --previous deployment/d3vonn-backend -n d3vonn

# Check for OOMKill (memory limit too low)
kubectl describe pod <pod-name> -n d3vonn | grep -A5 "Last State"

# Force a clean restart
kubectl rollout restart deployment/d3vonn-backend -n d3vonn
```

---

## Scenario 2: Full EKS Node Failure (Tier 2)

The HPA and topology spread constraints ensure pods are distributed across nodes and AZs. A single node failure should be transparent to users.

**Verify cluster health:**
```bash
kubectl get nodes
kubectl get pods -n d3vonn -o wide   # Check pods redistributed to healthy nodes
```

**If nodes are stuck in NotReady:**
```bash
# Check node conditions
kubectl describe node <node-name>

# Drain and cordon the failed node
kubectl cordon <node-name>
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Trigger node group scale-up (if ASG is not auto-healing)
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name d3vonn-node-group \
  --desired-capacity <current+1> \
  --region us-east-1
```

---

## Scenario 3: Database Corruption or Accidental Deletion (Tier 3)

Supabase (PostgreSQL) has automated daily backups with 30-day retention (configured in Phase 3).

**Restore from Supabase backup:**
1. Go to **Supabase Dashboard → Database → Backups**.
2. Select the most recent backup before the incident.
3. Click **Restore** and confirm. This creates a new database instance.
4. Update the `DATABASE_URL` secret in GitHub Actions and Kubernetes.
5. Restart the backend deployment: `kubectl rollout restart deployment/d3vonn-backend -n d3vonn`.

**Verify data integrity after restore:**
```bash
# Run the Supabase migration to ensure schema is current
supabase db push --project-ref <project-id>

# Run smoke tests
curl https://api.d3vonn.io/status/health/deep
```

---

## Scenario 4: Full Region Failure (Tier 4)

In the event of a full AWS us-east-1 outage, the Vercel frontend remains available (Vercel uses a global CDN). The backend API and database will be unavailable until the region recovers or a failover is executed.

**Immediate actions (0–15 minutes):**
1. Confirm the outage is AWS-wide via the [AWS Service Health Dashboard](https://health.aws.amazon.com/).
2. Enable maintenance mode on the frontend by setting the `VITE_MAINTENANCE_MODE=true` environment variable in Vercel and redeploying.
3. Post a status update to the [status page](https://status.d3vonn.io) and Slack.

**Failover to us-west-2 (15–240 minutes):**
```bash
# Re-apply Terraform targeting us-west-2
cd terraform
terraform workspace new us-west-2 || terraform workspace select us-west-2
terraform apply -var="aws_region=us-west-2" -auto-approve

# Update DNS to point to the new ALB in us-west-2
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch file://dns/failover-to-us-west-2.json
```

---

## Scenario 5: Secret Compromise (Tier 5)

If any production secret is suspected to be compromised (e.g., exposed in a log, leaked in a PR):

**Immediate rotation checklist:**

| Secret | Rotation Method |
| :--- | :--- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS IAM → Delete key → Create new key → Update GitHub Secrets |
| `OPENAI_API_KEY` | OpenAI Dashboard → Revoke key → Create new key → Update GitHub Secrets + Supabase Edge Function Secrets |
| `JWT_SECRET` | Generate new 256-bit secret → Update Kubernetes Secret → Rolling restart backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → API Settings → Regenerate → Update all consumers |
| `DATABASE_URL` password | Supabase Dashboard → Database → Reset password → Update Kubernetes Secret |

**After rotation:**
```bash
# Verify no old secrets remain in git history
git log --all --full-history -p -- .env | grep -E "sk-|AKIA|eyJ"

# Audit GitHub Actions secrets
gh secret list --repo wesship/supreme-ai-deployment-hub

# Scan for any remaining hardcoded secrets
grep -r "sk-" src/ --include="*.ts" --include="*.tsx"
```

---

## Runbook Maintenance

This runbook must be reviewed and tested quarterly. The next scheduled DR drill is due **August 15, 2026**. Assign a DR owner to each tier and document the results of each drill in `docs/dr-drill-log.md`.
