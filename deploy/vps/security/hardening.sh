#!/bin/bash
# =============================================================================
# D3VONN.IO — VPS Security Hardening Script
# =============================================================================
# Run this script ONCE during initial VPS setup.
# Configures: UFW firewall, Fail2Ban, SSH hardening, system security.
#
# Prerequisites:
#   - Ubuntu 24.04 LTS
#   - Root or sudo access
#   - SSH key authentication already configured
# =============================================================================

set -euo pipefail

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  D3VONN.IO — VPS Security Hardening                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Ensure running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# ── System Updates ───────────────────────────────────────────────────────────
echo "━━━ Step 1: System Updates ━━━"
apt-get update -y
apt-get upgrade -y
apt-get dist-upgrade -y
apt-get autoremove -y
echo "✓ System updated"

# ── Install Security Packages ────────────────────────────────────────────────
echo ""
echo "━━━ Step 2: Installing Security Packages ━━━"
apt-get install -y \
    ufw \
    fail2ban \
    unattended-upgrades \
    apt-listchanges \
    logwatch \
    rkhunter \
    lynis \
    auditd \
    libpam-tmpdir
echo "✓ Security packages installed"

# ── UFW Firewall Configuration ───────────────────────────────────────────────
echo ""
echo "━━━ Step 3: Configuring UFW Firewall ━━━"

# Reset UFW to defaults
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (rate limited)
ufw limit 22/tcp comment "SSH rate-limited"

# Allow HTTP and HTTPS
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"

# Enable UFW
ufw --force enable
ufw status verbose

echo "✓ UFW firewall configured"

# ── Fail2Ban Configuration ───────────────────────────────────────────────────
echo ""
echo "━━━ Step 4: Configuring Fail2Ban ━━━"

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd
banaction = ufw

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /opt/d3vonn/deploy/vps/nginx/logs/error.log
maxretry = 5

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /opt/d3vonn/deploy/vps/nginx/logs/error.log
maxretry = 10
bantime = 600

[nginx-botsearch]
enabled = true
port = http,https
filter = nginx-botsearch
logpath = /opt/d3vonn/deploy/vps/nginx/logs/access.log
maxretry = 2
bantime = 86400
EOF

# Create nginx-limit-req filter
cat > /etc/fail2ban/filter.d/nginx-limit-req.conf << 'EOF'
[Definition]
failregex = limiting requests, excess:.* by zone.*client: <HOST>
ignoreregex =
EOF

systemctl enable fail2ban
systemctl restart fail2ban

echo "✓ Fail2Ban configured"

# ── SSH Hardening ────────────────────────────────────────────────────────────
echo ""
echo "━━━ Step 5: Hardening SSH Configuration ━━━"

# Backup original config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

cat > /etc/ssh/sshd_config.d/99-d3vonn-hardening.conf << 'EOF'
# D3VONN.IO SSH Hardening
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
MaxAuthTries 3
MaxSessions 5
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 30
AllowAgentForwarding no
AllowTcpForwarding no
EOF

# Validate SSH config before restarting
sshd -t && systemctl restart sshd
echo "✓ SSH hardened"

# ── Kernel Security Parameters ───────────────────────────────────────────────
echo ""
echo "━━━ Step 6: Kernel Security Parameters ━━━"

cat > /etc/sysctl.d/99-d3vonn-security.conf << 'EOF'
# D3VONN.IO Kernel Security Parameters

# IP Spoofing protection
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP broadcast requests
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Ignore send redirects
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0

# Block SYN attacks
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5

# Log Martians
net.ipv4.conf.all.log_martians = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1

# Disable IPv6 if not needed
# net.ipv6.conf.all.disable_ipv6 = 1
# net.ipv6.conf.default.disable_ipv6 = 1

# Increase file descriptor limits
fs.file-max = 65535

# Increase connection tracking
net.netfilter.nf_conntrack_max = 131072
EOF

sysctl -p /etc/sysctl.d/99-d3vonn-security.conf
echo "✓ Kernel parameters hardened"

# ── Automatic Security Updates ───────────────────────────────────────────────
echo ""
echo "━━━ Step 7: Configuring Automatic Security Updates ━━━"

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

echo "✓ Automatic security updates configured"

# ── File Permissions ─────────────────────────────────────────────────────────
echo ""
echo "━━━ Step 8: Securing File Permissions ━━━"

chmod 700 /root
chmod 600 /etc/ssh/sshd_config
chmod 644 /etc/ssh/sshd_config.d/*

# Secure cron
chmod 600 /etc/crontab
chmod 700 /etc/cron.d
chmod 700 /etc/cron.daily
chmod 700 /etc/cron.hourly
chmod 700 /etc/cron.weekly
chmod 700 /etc/cron.monthly

echo "✓ File permissions secured"

# ── Docker Security ──────────────────────────────────────────────────────────
echo ""
echo "━━━ Step 9: Docker Security Configuration ━━━"

# Create Docker daemon configuration
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "live-restore": true,
  "userns-remap": "default",
  "no-new-privileges": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  },
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65535,
      "Soft": 65535
    }
  }
}
EOF

systemctl restart docker 2>/dev/null || true
echo "✓ Docker security configured"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Security hardening complete!"
echo ""
echo "Summary of changes:"
echo "  ✓ UFW firewall (ports 22, 80, 443 only)"
echo "  ✓ Fail2Ban (SSH, Nginx rate limiting, bot detection)"
echo "  ✓ SSH hardened (key-only, no root login)"
echo "  ✓ Kernel security parameters"
echo "  ✓ Automatic security updates"
echo "  ✓ File permissions secured"
echo "  ✓ Docker daemon hardened"
echo ""
echo "Next steps:"
echo "  1. Run 'lynis audit system' for a full security audit"
echo "  2. Review /var/log/fail2ban.log for blocked IPs"
echo "  3. Test SSH access before closing current session"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
