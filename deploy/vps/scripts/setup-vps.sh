#!/bin/bash
# =============================================================================
# D3VONN.IO — VPS Initial Setup Script (Hostinger)
# =============================================================================
# Run this script on a fresh Ubuntu 24.04 LTS VPS to prepare it for D3VONN.IO.
#
# What this script does:
#   1. Creates a deploy user with sudo access
#   2. Installs Docker and Docker Compose
#   3. Installs required system packages
#   4. Clones the repository
#   5. Sets up the project directory structure
#   6. Configures log rotation
#   7. Sets up daily backup cron
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/wesship/supreme-ai-deployment-hub/main/deploy/vps/scripts/setup-vps.sh | sudo bash
#
# Or manually:
#   sudo bash setup-vps.sh
# =============================================================================

set -euo pipefail

# Configuration
DEPLOY_USER="${DEPLOY_USER:-d3vonn}"
PROJECT_DIR="/opt/d3vonn"
REPO_URL="https://github.com/wesship/supreme-ai-deployment-hub.git"
BRANCH="${BRANCH:-main}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  D3VONN.IO — VPS Initial Setup                             ║"
echo "║  Target: Hostinger VPS (Ubuntu 24.04 LTS)                  ║"
echo "║  Specs:  4 vCPU / 16 GB RAM / 200 GB NVMe                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Ensure running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# ── Step 1: System Update ────────────────────────────────────────────────────
echo "━━━ Step 1/8: System Update ━━━"
apt-get update -y && apt-get upgrade -y
echo "✓ System updated"

# ── Step 2: Create Deploy User ───────────────────────────────────────────────
echo ""
echo "━━━ Step 2/8: Creating Deploy User ━━━"

if id "$DEPLOY_USER" &>/dev/null; then
    echo "User $DEPLOY_USER already exists, skipping..."
else
    useradd -m -s /bin/bash -G sudo "$DEPLOY_USER"
    echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$DEPLOY_USER"
    chmod 440 "/etc/sudoers.d/$DEPLOY_USER"

    # Copy SSH keys from root if they exist
    if [ -d /root/.ssh ]; then
        mkdir -p "/home/$DEPLOY_USER/.ssh"
        cp /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/" 2>/dev/null || true
        chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
        chmod 700 "/home/$DEPLOY_USER/.ssh"
        chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null || true
    fi
    echo "✓ Deploy user '$DEPLOY_USER' created"
fi

# ── Step 3: Install System Dependencies ──────────────────────────────────────
echo ""
echo "━━━ Step 3/8: Installing System Dependencies ━━━"

apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    htop \
    iotop \
    ncdu \
    tree \
    jq \
    wget \
    zip \
    unzip \
    net-tools \
    dnsutils \
    software-properties-common

echo "✓ System dependencies installed"

# ── Step 4: Install Docker ───────────────────────────────────────────────────
echo ""
echo "━━━ Step 4/8: Installing Docker ━━━"

if command -v docker &>/dev/null; then
    echo "Docker already installed: $(docker --version)"
else
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add the repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Add deploy user to docker group
    usermod -aG docker "$DEPLOY_USER"

    # Enable and start Docker
    systemctl enable docker
    systemctl start docker

    echo "✓ Docker installed: $(docker --version)"
fi

# ── Step 5: Clone Repository ────────────────────────────────────────────────
echo ""
echo "━━━ Step 5/8: Cloning Repository ━━━"

if [ -d "$PROJECT_DIR" ]; then
    echo "Project directory already exists, pulling latest..."
    cd "$PROJECT_DIR"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
else
    git clone -b "$BRANCH" "$REPO_URL" "$PROJECT_DIR"
fi

chown -R "$DEPLOY_USER:$DEPLOY_USER" "$PROJECT_DIR"
echo "✓ Repository cloned to $PROJECT_DIR"

# ── Step 6: Setup Project Structure ─────────────────────────────────────────
echo ""
echo "━━━ Step 6/8: Setting Up Project Structure ━━━"

# Create required directories
mkdir -p "$PROJECT_DIR/deploy/vps/ssl/certs"
mkdir -p "$PROJECT_DIR/deploy/vps/ssl/webroot"
mkdir -p "$PROJECT_DIR/deploy/vps/nginx/logs"
mkdir -p "$PROJECT_DIR/deploy/vps/backups"
mkdir -p "/var/log/d3vonn"

# Set permissions
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$PROJECT_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/var/log/d3vonn"

echo "✓ Project structure created"

# ── Step 7: Configure Log Rotation ──────────────────────────────────────────
echo ""
echo "━━━ Step 7/8: Configuring Log Rotation ━━━"

cat > /etc/logrotate.d/d3vonn << 'EOF'
/opt/d3vonn/deploy/vps/nginx/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 d3vonn d3vonn
    sharedscripts
    postrotate
        docker exec d3vonn-nginx nginx -s reload 2>/dev/null || true
    endscript
}

/var/log/d3vonn/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 d3vonn d3vonn
}
EOF

echo "✓ Log rotation configured"

# ── Step 8: Setup Backup Cron ────────────────────────────────────────────────
echo ""
echo "━━━ Step 8/8: Setting Up Backup Schedule ━━━"

# Copy backup script
cp "$PROJECT_DIR/deploy/vps/scripts/backup.sh" /usr/local/bin/d3vonn-backup
chmod +x /usr/local/bin/d3vonn-backup

# Add daily backup cron (runs at 3 AM)
cat > /etc/cron.d/d3vonn-backup << 'EOF'
# D3VONN.IO Daily Backup
0 3 * * * d3vonn /usr/local/bin/d3vonn-backup >> /var/log/d3vonn/backup.log 2>&1
EOF

echo "✓ Daily backup scheduled (3:00 AM)"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VPS setup complete!"
echo ""
echo "Summary:"
echo "  ✓ Deploy user: $DEPLOY_USER"
echo "  ✓ Project directory: $PROJECT_DIR"
echo "  ✓ Docker: $(docker --version 2>/dev/null || echo 'installed')"
echo "  ✓ Docker Compose: $(docker compose version 2>/dev/null || echo 'installed')"
echo "  ✓ Log rotation: configured"
echo "  ✓ Daily backups: scheduled at 3:00 AM"
echo ""
echo "Next steps:"
echo "  1. Run security hardening: sudo bash $PROJECT_DIR/deploy/vps/security/hardening.sh"
echo "  2. Copy .env.example to .env and fill in secrets:"
echo "     cp $PROJECT_DIR/deploy/vps/env/.env.example $PROJECT_DIR/deploy/vps/.env"
echo "  3. Initialize SSL certificates:"
echo "     sudo bash $PROJECT_DIR/deploy/vps/ssl/init-ssl.sh"
echo "  4. Start the stack:"
echo "     cd $PROJECT_DIR/deploy/vps && docker compose up -d"
echo "  5. (Optional) Start monitoring:"
echo "     docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
