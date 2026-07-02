# D3VONN.IO Hermes on Hostinger VPS

This guide turns the Hostinger VPS into a production deployment target for D3VONN.IO, Hermes, and the supporting agent runtime.

## Recommended VPS

Use Hostinger KVM 2 as the minimum. Use KVM 4 if the VPS will run the frontend, FastAPI backend, Redis, Hermes, monitoring, scheduled workers, and agent jobs together.

Recommended operating system: Ubuntu 24.04 LTS.

## Target routing

| Hostname | Service |
| --- | --- |
| `d3vonn.io` | public frontend |
| `www.d3vonn.io` | public frontend |
| `api.d3vonn.io` | FastAPI backend |
| `hermes.d3vonn.io` | Hermes control surface if exposed |
| `vault.d3vonn.io` | credential proxy / Agent Vault, locked down |

## Deployment order

1. Provision Hostinger VPS with Ubuntu 24.04 LTS.
2. Point DNS to the VPS through Cloudflare.
3. Run `deploy/vps/scripts/bootstrap-vps.sh`.
4. Copy `deploy/vps/env.hostinger.example` to `deploy/vps/.env`.
5. Fill `.env` only on the server. Never commit real values.
6. Start base services with Docker Compose.
7. Confirm backend health.
8. Start Hermes.
9. Add vault/proxy mode before enabling high-value external tools.
10. Connect Telegram, Twilio, Vapi, GitHub, Supabase, Pinecone, and monitoring.

## Base commands

```bash
cd /opt/d3vonn/supreme-ai-deployment-hub
git pull origin main
cp deploy/vps/env.hostinger.example deploy/vps/.env
nano deploy/vps/.env

docker compose \
  -f deploy/vps/docker-compose.yml \
  --env-file deploy/vps/.env \
  up -d --build
```

## Health checks

```bash
bash deploy/vps/scripts/healthcheck.sh

docker ps
curl -fsS https://api.d3vonn.io/health
curl -fsS https://d3vonn.io
```

## Production notes

Hermes should not become the long-term storage place for provider credentials. Use a vault/proxy pattern so credentials can be revoked centrally without rebuilding Hermes.

Keep these protections enabled:

- UFW firewall
- Fail2Ban
- Cloudflare proxy
- HTTPS certificates
- Docker network isolation
- JSON log rotation
- Daily backups
- Health checks before releases

## Rollback

```bash
cd /opt/d3vonn/supreme-ai-deployment-hub
git log --oneline -n 10
git checkout <known-good-commit>
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env up -d --build
```
