#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-deploy/vps/env/.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Environment file not found: $ENV_FILE" >&2
  echo "Create it from deploy/vps/env/.env.example and add production values." >&2
  exit 1
fi

# Load values without printing secrets.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

errors=0
warnings=0

required() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "MISSING: $name"
    errors=$((errors + 1))
  elif [[ "$value" =~ ^(your-|replace-|change-|generate-|sk-\.\.\.|\.\.\.|<) ]]; then
    echo "PLACEHOLDER: $name"
    errors=$((errors + 1))
  else
    echo "OK: $name"
  fi
}

optional() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "OPTIONAL: $name is not configured"
    warnings=$((warnings + 1))
  else
    echo "OK: $name"
  fi
}

echo "Validating D3VONN.IO production environment: $ENV_FILE"
echo

echo "Core Supabase"
required SUPABASE_URL
required SUPABASE_SERVICE_ROLE_KEY
required VITE_SUPABASE_URL
required VITE_SUPABASE_ANON_KEY

echo
echo "Core AI and RAG"
required OPENAI_API_KEY
required PINECONE_API_KEY
required PINECONE_HOST
required PINECONE_INDEX_NAME

echo
echo "Security"
required JWT_SECRET
required ENCRYPTION_KEY
required API_KEY_VAULT_SECRET
required WS_AUTH_TOKEN
required REDIS_PASSWORD

echo
echo "Runtime"
required VITE_API_URL
required ALLOWED_ORIGINS_RAW
optional DATABASE_URL
optional SENTRY_DSN

echo
echo "Optional providers"
optional ANTHROPIC_API_KEY
optional GOOGLE_AI_API_KEY
optional ELEVENLABS_API_KEY
optional ASSEMBLYAI_API_KEY
optional DEEPGRAM_API_KEY
optional N8N_API_KEY
optional N8N_WEBHOOK_SECRET
optional TWILIO_ACCOUNT_SID
optional TWILIO_AUTH_TOKEN
optional GITHUB_TOKEN

# Structural checks that do not expose secret values.
if [[ "${SUPABASE_URL:-}" != "https://tjygexesognbkwualywq.supabase.co" ]]; then
  echo "ERROR: SUPABASE_URL does not match the configured D3VONN.IO Supabase project."
  errors=$((errors + 1))
fi

if [[ "${VITE_SUPABASE_URL:-}" != "https://tjygexesognbkwualywq.supabase.co" ]]; then
  echo "ERROR: VITE_SUPABASE_URL does not match the configured D3VONN.IO Supabase project."
  errors=$((errors + 1))
fi

if [[ -n "${JWT_SECRET:-}" && ${#JWT_SECRET} -lt 64 ]]; then
  echo "ERROR: JWT_SECRET must be at least 64 characters."
  errors=$((errors + 1))
fi

if [[ -n "${ENCRYPTION_KEY:-}" && ${#ENCRYPTION_KEY} -lt 32 ]]; then
  echo "ERROR: ENCRYPTION_KEY must be at least 32 characters."
  errors=$((errors + 1))
fi

if [[ "$errors" -gt 0 ]]; then
  echo
  echo "FAILED: $errors required configuration problem(s), $warnings optional warning(s)."
  exit 1
fi

echo
echo "PASSED: Production environment is structurally ready ($warnings optional warning(s))."
