# Devonn.ai Deployment Runbook

Production playbook for the split-stack architecture:

```text
User
 └─ d3vonn.io          (Vercel frontend)
     └─ api.d3vonn.io  (Railway custom domain → FastAPI → Devonn AI Agents)
```

---

## 🚀 Deploy Flow

```bash
git push origin main
```

GitHub Actions and platform deploy hooks publish the frontend and API service. Keep deployment evidence tied to the active Vercel frontend project and Railway API service for the d3vonn.io cutover.

---

## 🔍 Verify

```bash
curl https://api.d3vonn.io/status/health
curl https://api.d3vonn.io/status/health/deep
curl https://api.d3vonn.io/status/dns-status
curl https://d3vonn.io
```

Expected: HTTP 200 from all four, or the documented frontend redirect for the apex/www route.

---

## 🔧 Rollback

Use the current platform rollback controls for the affected service:

- Vercel: redeploy or promote the last known-good frontend deployment.
- Railway: redeploy or roll back the last known-good API deployment.
- DNS: restore the previous Hostinger DNS record values only if the platform domain attachment is confirmed broken.

---

## 🌐 DNS Check

```bash
dig d3vonn.io +short
dig www.d3vonn.io +short
dig api.d3vonn.io +short
dig NS d3vonn.io +short
```

Required evidence for the current cutover:

- Hostinger DNS zone shows the apex, www, and api records.
- `d3vonn.io` resolves to the Vercel apex target.
- `www.d3vonn.io` resolves through the Vercel CNAME target.
- `api.d3vonn.io` resolves through the Railway custom-domain CNAME target.

---

## 🚨 Emergency Triage

Check platform dashboards first:

- Vercel frontend deployment status and domain verification.
- Railway API deployment status, logs, custom-domain verification, and SSL status.
- Supabase Auth Site URL and redirect allow-list entries.

Then verify externally:

```bash
curl -I https://d3vonn.io
curl -I https://www.d3vonn.io
curl https://api.d3vonn.io/health
```

---

## 📊 Monitoring Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /status/health` | Shallow liveness |
| `GET /status/health/deep` | Deep dependency check |
| `GET /status/dns-status` | DNS resolution snapshot |
| `GET /status/metrics` | Lightweight metrics snapshot |

---

## 📜 Logs

Use Railway service logs for the production API and Vercel deployment logs for the frontend.

Future upgrade: Loki + Grafana, or ELK.

---

## 🔐 Secrets / Credentials

- Keep production secrets in platform dashboards or approved secret stores.
- Never echo secret environment variables in CI logs.
- Rotate credentials through the owning provider dashboard and update dependent services after rotation.
