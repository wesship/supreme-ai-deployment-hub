# D3VONN.IO VPS Runbook

## Server baseline

Recommended path on the server:

```bash
/opt/d3vonn/supreme-ai-deployment-hub
```

## First-time setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw fail2ban nginx certbot python3-certbot-nginx
sudo mkdir -p /opt/d3vonn
sudo chown -R $USER:$USER /opt/d3vonn
cd /opt/d3vonn
git clone https://github.com/wesship/supreme-ai-deployment-hub.git
cd supreme-ai-deployment-hub
bash deploy/vps/scripts/bootstrap-vps.sh
```

## Start services

```bash
cd /opt/d3vonn/supreme-ai-deployment-hub
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env up -d --build
```

## Stop services

```bash
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env down
```

## View logs

```bash
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env logs -f backend
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env logs -f hermes
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env logs -f redis
```

## Health check

```bash
bash deploy/vps/scripts/healthcheck.sh
```

Expected checks:

- Docker is running
- Compose file is valid
- containers are up
- Redis responds
- backend health endpoint responds
- frontend route responds

## Release process

```bash
cd /opt/d3vonn/supreme-ai-deployment-hub
git pull origin main
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env config >/tmp/d3vonn-compose-check.yml
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env up -d --build
bash deploy/vps/scripts/healthcheck.sh
```

## Emergency rollback

```bash
cd /opt/d3vonn/supreme-ai-deployment-hub
git log --oneline -n 20
git checkout <known-good-commit>
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env up -d --build
bash deploy/vps/scripts/healthcheck.sh
```

## Daily checks

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker system df
sudo journalctl -u docker --since '24 hours ago' --no-pager | tail -100
```

## Backup command

```bash
bash deploy/vps/scripts/backup-postgres.sh
```

If Supabase is used as the managed database, use Supabase backups as the primary database backup and this local script only for local Postgres containers.
