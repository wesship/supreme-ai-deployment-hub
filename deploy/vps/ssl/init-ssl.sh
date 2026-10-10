#!/bin/bash
# =============================================================================
# D3VONN.IO — SSL Certificate Initialization (Let's Encrypt)
# =============================================================================
# Run this script ONCE during initial VPS setup to obtain SSL certificates.
# After initial setup, the certbot container handles automatic renewal.
#
# Prerequisites:
#   - DNS A records pointing to VPS IP for d3vonn.io, www.d3vonn.io, api.d3vonn.io
#   - Port 80 accessible from the internet
#   - Docker and Docker Compose installed
# =============================================================================

set -euo pipefail

# Configuration
DOMAIN="${DOMAIN:-d3vonn.io}"
EMAIL="${CERTBOT_EMAIL:-admin@d3vonn.io}"
STAGING="${STAGING:-0}"  # Set to 1 for testing with Let's Encrypt staging

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="${SCRIPT_DIR}/certs"
WEBROOT_DIR="${SCRIPT_DIR}/webroot"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  D3VONN.IO — SSL Certificate Initialization                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Domain: ${DOMAIN}"
echo "Email:  ${EMAIL}"
echo "Mode:   $([ "$STAGING" = "1" ] && echo "STAGING (test)" || echo "PRODUCTION")"
echo ""

# Create directories
mkdir -p "${CERT_DIR}" "${WEBROOT_DIR}"

# Check if certificates already exist
if [ -d "${CERT_DIR}/live/${DOMAIN}" ]; then
    echo "⚠️  Certificates already exist for ${DOMAIN}."
    read -p "Do you want to renew/replace them? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Staging flag
STAGING_FLAG=""
if [ "$STAGING" = "1" ]; then
    STAGING_FLAG="--staging"
    echo "⚠️  Using Let's Encrypt STAGING environment (certificates will NOT be trusted)"
fi

# Step 1: Start a temporary nginx for ACME challenge
echo ""
echo "━━━ Step 1: Starting temporary web server for ACME challenge ━━━"

# Create a minimal nginx config for the ACME challenge
cat > /tmp/nginx-acme.conf << 'EOF'
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name _;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 200 "D3VONN.IO SSL Setup in progress";
            add_header Content-Type text/plain;
        }
    }
}
EOF

docker run -d --name d3vonn-acme-nginx \
    -p 80:80 \
    -v /tmp/nginx-acme.conf:/etc/nginx/nginx.conf:ro \
    -v "${WEBROOT_DIR}:/var/www/certbot" \
    nginx:1.27-alpine

echo "✓ Temporary nginx started"

# Step 2: Request certificates
echo ""
echo "━━━ Step 2: Requesting SSL certificates from Let's Encrypt ━━━"

docker run --rm \
    -v "${CERT_DIR}:/etc/letsencrypt" \
    -v "${WEBROOT_DIR}:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "${DOMAIN}" \
    -d "www.${DOMAIN}" \
    -d "api.${DOMAIN}" \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    ${STAGING_FLAG}

# Step 3: Cleanup temporary nginx
echo ""
echo "━━━ Step 3: Cleaning up temporary server ━━━"
docker stop d3vonn-acme-nginx && docker rm d3vonn-acme-nginx
echo "✓ Temporary nginx removed"

# Step 4: Verify certificates
echo ""
echo "━━━ Step 4: Verifying certificates ━━━"
if [ -f "${CERT_DIR}/live/${DOMAIN}/fullchain.pem" ]; then
    echo "✓ Certificate obtained successfully!"
    echo ""
    echo "Certificate details:"
    docker run --rm -v "${CERT_DIR}:/etc/letsencrypt" certbot/certbot certificates
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ SSL setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Start the full stack: docker compose up -d"
    echo "  2. The certbot container will handle automatic renewal"
    echo "  3. Nginx will reload automatically on renewal"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "❌ Certificate generation failed!"
    echo "Check the logs above for errors."
    echo ""
    echo "Common issues:"
    echo "  - DNS not propagated (check with: dig ${DOMAIN})"
    echo "  - Port 80 blocked by firewall"
    echo "  - Rate limit exceeded (use STAGING=1 for testing)"
    exit 1
fi
