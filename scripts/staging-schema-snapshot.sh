#!/usr/bin/env bash
# Export a private, schema-only snapshot of the linked staging project.
# The output is deliberately outside the Git checkout and is not a migration.
set -euo pipefail
umask 077

staging_ref=ypomzwhtaamxdmcwtpyf

if [[ $# -ne 0 ]]; then
  echo 'Usage: STAGING_DATABASE_URL=<staging connection URI> staging-schema-snapshot.sh' >&2
  exit 2
fi
if [[ -z "${STAGING_DATABASE_URL:-}" ]]; then
  echo 'STAGING_DATABASE_URL is required; do not paste it into a command or commit it.' >&2
  exit 2
fi
command -v python3 >/dev/null || { echo 'python3 is required' >&2; exit 2; }
command -v supabase >/dev/null || { echo 'Supabase CLI is required' >&2; exit 2; }

# Validate both direct and Supavisor session-pooler URIs without logging the URI.
python3 - "$staging_ref" <<'PY'
import os
import sys
from urllib.parse import unquote, urlparse

ref = sys.argv[1]
uri = urlparse(os.environ['STAGING_DATABASE_URL'])
host = (uri.hostname or '').lower()
user = unquote(uri.username or '')
direct = host == f'db.{ref}.supabase.co' and user == 'postgres'
pooler = host.endswith('.pooler.supabase.com') and user == f'postgres.{ref}'
if uri.scheme not in ('postgres', 'postgresql') or not (direct or pooler) or not uri.password:
    sys.exit('Refusing database URI: expected authenticated staging project ' + ref)
PY

help_text="$(supabase db dump --help)"
if [[ "$help_text" != *'--db-url'* || "$help_text" != *'--file'* ]]; then
  echo 'Supabase CLI lacks the documented db dump flags; update the CLI.' >&2
  exit 2
fi

snapshot="$(mktemp "${TMPDIR:-/tmp}/staging-schema.XXXXXXXX.sql")"
trap 'rm -f "$snapshot"' ERR
# Supabase CLI's default dump is schema-only and excludes managed schemas,
# data and roles. No --data-only or --role-only flag is passed.
supabase db dump --db-url "$STAGING_DATABASE_URL" --file "$snapshot"
test -s "$snapshot" || { echo 'Empty schema dump' >&2; exit 1; }
printf 'Staging schema snapshot (private): %s\n' "$snapshot"
sha256sum "$snapshot"
echo 'Review for literals and privileged SQL before converting any part to migrations.'
