# Devonn.ai Deployment Runbook

Production playbook for the split-stack architecture:

```
User
 └─ devonn.ai          (Lovable frontend)
     └─ api.devonn.ai  (AWS ALB → EKS → FastAPI → Devonn AI Agents)
```

---

## 🚀 Deploy Flow

```bash
git push origin main
```

GitHub Actions → Docker build → Push to ECR → `kubectl rollout restart deployment/devonn-api`

---

## 🔍 Verify

```bash
curl https://api.devonn.ai/status/health
curl https://api.devonn.ai/status/health/deep
curl https://api.devonn.ai/status/dns-status
curl https://devonn.ai
```

Expected: HTTP 200 from all four.

---

## 🔧 Rollback

```bash
kubectl rollout undo deployment/devonn-api
kubectl rollout status deployment/devonn-api
```

---

## 🌐 DNS Check

```bash
dig devonn.ai +short
dig api.devonn.ai +short
dig NS devonn.ai +short   # must show ns-*.awsdns-* after registrar flip
```

ACM certificate status:

```bash
aws acm list-certificates --region us-east-1
aws acm describe-certificate --certificate-arn <arn> --region us-east-1
```

---

## 🚨 Emergency Triage

```bash
kubectl get pods -n default
kubectl logs -f deployment/devonn-api
kubectl describe pod <pod>
kubectl get events --sort-by=.lastTimestamp | tail -20
```

Restart a single pod:

```bash
kubectl delete pod <pod>   # ReplicaSet recreates it
```

---

## 📊 Monitoring Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /status/health` | Shallow liveness (used by ALB) |
| `GET /status/health/deep` | Deep dependency check |
| `GET /status/dns-status` | DNS resolution snapshot |
| `GET /status/metrics` | Lightweight metrics snapshot |

---

## 📜 Logs

```bash
kubectl logs -f deployment/devonn-api
kubectl logs --previous deployment/devonn-api   # crashed container
```

Future upgrade: Loki + Grafana, or ELK.

---

## 🔐 Secrets / Credentials

- AWS keys: stored encrypted in Supabase via `encrypt_credentials` RPC.
- Never echo secret env vars in CI logs.
- Rotate via Lovable Cloud → Connectors.
