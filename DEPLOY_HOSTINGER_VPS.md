# Hostinger VPS deployment for d3vonn.io

This guide deploys `wesship/supreme-ai-deployment-hub` on a Hostinger Ubuntu VPS with Docker Compose.

## DNS prerequisites

Point these DNS records to the Hostinger VPS public IPv4 address:

- `d3vonn.io`
- `www.d3vonn.io`
- `api.d3vonn.io`
- `hermes.d3vonn.io` if enabled by the Nginx/route layer
- `ops.d3vonn.io` if enabled by the Nginx/route layer

## 1. Connect to Hostinger terminal

Use Hostinger hPanel → VPS → Manage → Terminal.

## 2. Install base dependencies

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git gnupg nano nginx ufw
```

## 3. Install Docker and Compose

Use Docker's official Ubuntu install flow or Hostinger's Docker image. After installation, verify:

```bash
docker --version
docker compose version
```

## 4. Clone or update the repo

```bash
sudo mkdir -p /opt
cd /opt
if [ ! -d supreme-ai-deployment-hub ]; then
  sudo git clone https://github.com/wesship/supreme-ai-deployment-hub.git
fi
cd /opt/supreme-ai-deployment-hub
sudo git fetch origin main
sudo git checkout main
sudo git pull --ff-only origin main
```

## 5. Create the production env file

```bash
sudo cp -n deploy/vps/env/.env.example deploy/vps/env/.env.production
sudo chmod 600 deploy/vps/env/.env.production
sudo nano deploy/vps/env/.env.production
```

Never commit or paste real values for:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_AI_API_KEY`
- `PINECONE_API_KEY`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `TWILIO_AUTH_TOKEN`
- `GRAFANA_ADMIN_PASSWORD`
- AWS credentials

Only public browser-safe values should use `VITE_*` names.

## 6. Deploy

```bash
cd /opt/supreme-ai-deployment-hub
sudo APP_DIR=/opt/supreme-ai-deployment-hub bash deploy/vps/scripts/deploy.sh
```

## 7. Verify locally on the VPS

```bash
cd /opt/supreme-ai-deployment-hub
sudo docker compose --env-file deploy/vps/env/.env.production -f deploy/vps/docker-compose.yml ps
sudo docker ps --format "table {{.Names}}\t{{.Ports}}"
curl -f http://127.0.0.1/health
sudo docker exec d3vonn-backend curl -f http://localhost:8000/health/live
sudo docker exec d3vonn-backend curl -f http://localhost:8000/health/ready
```

## 8. Verify public endpoints

After DNS and TLS are working:

```bash
curl -I https://d3vonn.io
curl -I https://api.d3vonn.io/health/live
curl -I https://api.d3vonn.io/health/ready
curl -I https://api.d3vonn.io/health/deep
```

## 9. Update later

```bash
cd /opt/supreme-ai-deployment-hub
sudo APP_DIR=/opt/supreme-ai-deployment-hub BRANCH=main bash deploy/vps/scripts/deploy.sh
```

## 10. Roll back

```bash
cd /opt/supreme-ai-deployment-hub
sudo APP_DIR=/opt/supreme-ai-deployment-hub bash deploy/vps/scripts/deploy.sh --rollback
```
