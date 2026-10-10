#!/usr/bin/env bash
# =============================================================================
# D3VONN.IO — Production Environment Preparation Script
# =============================================================================
# Generates all internal secrets that do not require an external account and
# injects them (and missing static config) directly into .env.production.
#
# Usage:
#   sudo bash deploy/vps/scripts/prepare-env.sh
#   sudo bash deploy/vps/scripts/prepare-env.sh --env-file /path/to/.env.production
#
# After this script completes, only three values require manual input:
#   OPENAI_API_KEY   — from https://platform.openai.com/api-keys
#   PINECONE_API_KEY — from https://app.pinecone.io
#   PINECONE_HOST    — from your Pinecone index settings
#
# This script is idempotent: it will NOT overwrite values that are already
# set to real (non-placeholder) values.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
ENV_FILE="${1:-${ROOT_DIR}/deploy/vps/env/.env.production}"
EXAMPLE_FILE="${ROOT_DIR}/deploy/vps/env/.env.example"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()     { echo -e "[$(date -Iseconds)] $1"; }
success() { echo -e "${GREEN}  SET${NC}  $1"; }
skipped() { echo -e "${YELLOW} SKIP${NC}  $1 (already set)"; }
warn()    { echo -e "${YELLOW} WARN${NC}  $1"; }
error()   { echo -e "${RED}  ERR${NC}  $1"; }

# ---------------------------------------------------------------------------
# Ensure .env.production exists
# ---------------------------------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
    if [[ ! -f "$EXAMPLE_FILE" ]]; then
        error "Neither $ENV_FILE nor $EXAMPLE_FILE found."
        exit 1
    fi
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    log "Created $ENV_FILE from template."
fi
chmod 600 "$ENV_FILE"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Return the current value of a variable in the env file (empty if absent).
get_val() {
    local key="$1"
    grep -m1 "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || true
}

# Return true if the value is empty or a known placeholder pattern.
is_placeholder() {
    local v="$1"
    [[ -z "$v" ]] && return 0
    echo "$v" | grep -qE '^(your-|replace-with|change-this|generate-a|generate-|sk-\.\.\.|<|PASTE_|CHANGE_ME|YOUR_)' && return 0
    return 1
}

# Set a key=value in the env file.
# If the key exists, replace its line; otherwise append.
set_val() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
        # Use a temp file to avoid sed -i portability issues
        local tmp
        tmp="$(mktemp)"
        sed "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" > "$tmp"
        mv "$tmp" "$ENV_FILE"
        chmod 600 "$ENV_FILE"
    else
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

# Generate or keep a secret.
# $1 = env var name
# $2 = generator command (e.g. "openssl rand -hex 64")
# $3 = human label
ensure_secret() {
    local key="$1"
    local generator="$2"
    local label="${3:-$1}"
    local current
    current="$(get_val "$key")"
    if is_placeholder "$current"; then
        local new_val
        new_val="$(eval "$generator")"
        set_val "$key" "$new_val"
        success "$label"
    else
        skipped "$label"
    fi
}

# Ensure a static (non-secret) value is set.
ensure_static() {
    local key="$1"
    local default_value="$2"
    local label="${3:-$1}"
    local current
    current="$(get_val "$key")"
    if is_placeholder "$current"; then
        set_val "$key" "$default_value"
        success "$label = $default_value"
    else
        skipped "$label"
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

echo "============================================================"
echo "  D3VONN.IO — Production Environment Preparation"
echo "  File: $ENV_FILE"
echo "============================================================"
echo ""

echo "── Generating internal secrets ──────────────────────────────"
ensure_secret "REDIS_PASSWORD"       "openssl rand -hex 32"   "REDIS_PASSWORD"
ensure_secret "JWT_SECRET"           "openssl rand -hex 64"   "JWT_SECRET"
ensure_secret "ENCRYPTION_KEY"       "openssl rand -base64 32 | tr -d '\n='" "ENCRYPTION_KEY"
ensure_secret "API_KEY_VAULT_SECRET" "openssl rand -hex 32"   "API_KEY_VAULT_SECRET"
ensure_secret "WS_AUTH_TOKEN"        "openssl rand -hex 32"   "WS_AUTH_TOKEN"

echo ""
echo "── Injecting missing static configuration ───────────────────"
ensure_static "PINECONE_INDEX_NAME"  "devonn-rag"             "PINECONE_INDEX_NAME"
ensure_static "ALLOWED_ORIGINS_RAW"  "https://d3vonn.io,https://www.d3vonn.io,https://app.d3vonn.io" "ALLOWED_ORIGINS_RAW"
ensure_static "VITE_API_URL"         "https://api.d3vonn.io"  "VITE_API_URL"
ensure_static "REDIS_URL"            'redis://:${REDIS_PASSWORD}@redis:6379/0' "REDIS_URL (template)"
ensure_static "HERMES_MAX_CONCURRENT_TASKS" "10"              "HERMES_MAX_CONCURRENT_TASKS"
ensure_static "HERMES_POLL_INTERVAL_SECONDS" "10"             "HERMES_POLL_INTERVAL_SECONDS"
ensure_static "HERMES_MAX_TASKS_PER_TICK" "5"                 "HERMES_MAX_TASKS_PER_TICK"
ensure_static "HERMES_DEFAULT_AGENT" "TARS"                   "HERMES_DEFAULT_AGENT"
ensure_static "OPENAI_DEFAULT_MODEL" "gpt-4.1-mini"           "OPENAI_DEFAULT_MODEL"
ensure_static "EMBEDDING_MODEL"      "text-embedding-3-small" "EMBEDDING_MODEL"
ensure_static "CERTBOT_EMAIL"        "admin@d3vonn.io"        "CERTBOT_EMAIL"
ensure_static "GRAFANA_ADMIN_USER"   "admin"                  "GRAFANA_ADMIN_USER"
ensure_static "GRAFANA_ADMIN_PASSWORD" "$(openssl rand -hex 16)" "GRAFANA_ADMIN_PASSWORD"

echo ""
echo "── Checking external API keys (require manual input) ────────"

OPENAI_VAL="$(get_val "OPENAI_API_KEY")"
PINECONE_KEY_VAL="$(get_val "PINECONE_API_KEY")"
PINECONE_HOST_VAL="$(get_val "PINECONE_HOST")"
SUPABASE_URL_VAL="$(get_val "SUPABASE_URL")"
SUPABASE_KEY_VAL="$(get_val "SUPABASE_SERVICE_ROLE_KEY")"

MANUAL_NEEDED=0

check_external() {
    local key="$1"
    local val="$2"
    local hint="$3"
    if is_placeholder "$val"; then
        warn "$key — NEEDS MANUAL INPUT: $hint"
        MANUAL_NEEDED=$((MANUAL_NEEDED + 1))
    else
        skipped "$key"
    fi
}

check_external "OPENAI_API_KEY"           "$OPENAI_VAL"       "https://platform.openai.com/api-keys"
check_external "PINECONE_API_KEY"         "$PINECONE_KEY_VAL" "https://app.pinecone.io → API Keys"
check_external "PINECONE_HOST"            "$PINECONE_HOST_VAL" "https://app.pinecone.io → your index → Host"
check_external "SUPABASE_URL"             "$SUPABASE_URL_VAL"  "https://supabase.com/dashboard → Project Settings → API"
check_external "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_KEY_VAL" "https://supabase.com/dashboard → Project Settings → API"

echo ""
echo "============================================================"

if [[ "$MANUAL_NEEDED" -gt 0 ]]; then
    echo ""
    warn "$MANUAL_NEEDED external key(s) still need manual values."
    echo ""
    echo "  Edit the env file and fill in the MISSING keys:"
    echo "    sudo nano $ENV_FILE"
    echo ""
    echo "  Then re-run the validator:"
    echo "    sudo bash deploy/vps/scripts/validate-production-env.sh $ENV_FILE"
    echo ""
    echo "  Then deploy:"
    echo "    sudo APP_DIR=${ROOT_DIR} bash deploy/vps/scripts/deploy.sh"
else
    echo ""
    success "All required values are set."
    echo ""
    echo "  Run the validator to confirm:"
    echo "    sudo bash deploy/vps/scripts/validate-production-env.sh $ENV_FILE"
    echo ""
    echo "  Then deploy:"
    echo "    sudo APP_DIR=${ROOT_DIR} bash deploy/vps/scripts/deploy.sh"
fi
