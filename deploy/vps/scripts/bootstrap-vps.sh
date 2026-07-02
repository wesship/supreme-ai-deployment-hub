#!/usr/bin/env bash
set -euo pipefail

APP_USER="${SUDO_USER:-$USER}"
APP_ROOT="/opt/d3vonn"
REPO_ROOT="$APP_ROOT/supreme-ai-deployment-hub"

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo bash deploy/vps/scripts/bootstrap-vps.sh"
  exit 1
fi

echo "==> Updating packages"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

echo "==> Installing base packages"
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates \
  curl \
  git \
  gnupg \
  lsb-release \
  ufw \
  fail2ban \
  nginx \
  certbot \
  python3-certbot-nginx \
  jq \
  unzip \
  htop

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "==> Enabling Docker"
systemctl enable docker
systemctl start docker
usermod -aG docker "$APP_USER" || true

echo "==> Creating app directories"
mkdir -p "$APP_ROOT" "$APP_ROOT/backups" "$APP_ROOT/logs"
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"

if [[ -d "$REPO_ROOT" ]]; then
  echo "==> Repo exists: $REPO_ROOT"
else
  echo "==> Clone repo into /opt/d3vonn before running deployment commands"
fi

echo "==> Configuring firewall"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Enabling Fail2Ban"
systemctl enable fail2ban
systemctl restart fail2ban

echo "==> Docker version"
docker --version
docker compose version

echo "==> Bootstrap complete"
echo "Next: copy deploy/vps/env.hostinger.example to deploy/vps/.env and fill server-only values."
