# D3VONN.IO — Hostinger VPS Deployment

This directory contains the complete deployment architecture for D3VONN.IO and the Hermes Orchestrator, specifically optimized for a Hostinger VPS environment.

## Architecture Overview

The deployment uses a containerized architecture orchestrated by Docker Compose:

- **Nginx**: Reverse proxy handling SSL termination, rate limiting, and routing.
- **React Frontend**: Built statically and served directly by Nginx.
- **FastAPI Backend**: The core API server.
- **Hermes Orchestrator**: AI task engine managing concurrent workflows.
- **Redis**: In-memory data store for caching and Celery task queues.
- **Celery Workers**: Background task execution.
- **AI Agents**: Specialized agents (Security, Opportunity, Knowledge Graph) running as independent containers.
- **Monitoring Stack**: Prometheus, Grafana, Loki, and Alertmanager for full observability.

## Server Requirements

Recommended specifications for different stages:

| Stage | Specifications | Capacity |
|-------|---------------|----------|
| **Development** | 2 vCPU / 8 GB RAM | Basic API, frontend, Redis, minimal agents |
| **Beta (Current)** | 4 vCPU / 16 GB RAM | Full stack, multiple agents, browser automation |
| **Production** | 8+ vCPU / 32 GB RAM | High concurrency, large vector operations |

*The current configuration is optimized for the Beta stage (4 vCPU / 16 GB RAM).*

## Directory Structure

```text
deploy/vps/
├── docker-compose.yml           # Main production compose file
├── docker-compose.monitoring.yml # Optional monitoring stack
├── env/
│   └── .env.example             # Environment variables template
├── nginx/
│   ├── nginx.conf               # Main Nginx configuration
│   ├── conf.d/
│   │   └── d3vonn.conf          # Virtual host definitions
│   └── logs/                    # Nginx log output
├── ssl/
│   ├── init-ssl.sh              # Let's Encrypt initialization script
│   ├── certs/                   # SSL certificates (volume)
│   └── webroot/                 # ACME challenge webroot
├── monitoring/                  # Prometheus, Grafana, Loki configs
├── security/
│   └── hardening.sh             # VPS security hardening script
├── scripts/
│   ├── setup-vps.sh             # Initial VPS setup automation
│   ├── deploy.sh                # Deployment helper script
│   ├── backup.sh                # Daily backup script
│   └── healthcheck.sh           # System health verification
└── backups/                     # Automated backup storage
```

## Initial Setup Guide

Follow these steps to deploy on a fresh Hostinger VPS running Ubuntu 24.04 LTS.

### 1. DNS Configuration

Before starting, ensure your DNS records point to the VPS IP address:
- `A` record for `d3vonn.io`
- `A` record for `www.d3vonn.io`
- `A` record for `api.d3vonn.io`

### 2. VPS Initialization

SSH into your VPS as `root` and run the automated setup script:

```bash
curl -sSL https://raw.githubusercontent.com/wesship/supreme-ai-deployment-hub/main/deploy/vps/scripts/setup-vps.sh | sudo bash
```

This script will:
- Create a `d3vonn` user with sudo access
- Install Docker and required packages
- Clone this repository to `/opt/d3vonn`
- Configure log rotation and automated backups

### 3. Security Hardening

Run the security hardening script to configure the firewall and Fail2Ban:

```bash
sudo bash /opt/d3vonn/deploy/vps/security/hardening.sh
```

### 4. Environment Configuration

Switch to the `d3vonn` user and configure the environment variables:

```bash
su - d3vonn
cd /opt/d3vonn/deploy/vps
cp env/.env.example .env
nano .env
```

Fill in all required API keys (OpenAI, Supabase, Pinecone, etc.).

### 5. SSL Certificate Initialization

Run the SSL initialization script to obtain Let's Encrypt certificates:

```bash
sudo bash ssl/init-ssl.sh
```

### 6. Start the Stack

Deploy the full stack using the deployment helper script:

```bash
./scripts/deploy.sh
```

To include the monitoring stack (Grafana/Prometheus):

```bash
./scripts/deploy.sh --with-monitoring
```

## Maintenance & Operations

### Checking Status

```bash
./scripts/deploy.sh --status
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f hermes
```

### Automated Backups

Backups are automatically configured to run daily at 3:00 AM via cron. They are stored in `/opt/d3vonn/deploy/vps/backups/`. You can manually trigger a backup:

```bash
sudo /usr/local/bin/d3vonn-backup
```

### Updating

The deployment is managed via GitHub Actions CI/CD (`.github/workflows/vps-deploy.yml`). Pushing to the `main` branch will automatically build new Docker images and deploy them to the VPS with zero downtime.

To manually update from the VPS:

```bash
./scripts/deploy.sh
```

## Migration Path

As D3VONN.IO grows beyond the capacity of a single VPS, this Docker Compose architecture is designed to easily migrate to Kubernetes (EKS/AKS) or AWS ECS. The container definitions remain identical, only the orchestration layer changes.
