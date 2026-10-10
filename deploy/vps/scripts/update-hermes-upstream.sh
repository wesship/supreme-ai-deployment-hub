#!/usr/bin/env bash
set -euo pipefail
umask 027

readonly TRUSTED_REPO="https://github.com/NousResearch/hermes-agent.git"
readonly DEFAULT_TAG="v2026.8.27"
readonly DEFAULT_COMMIT="5fc308a70719a83cccdbba4c0e39c23f5a8239d5"
readonly DEFAULT_VERSION="0.20.6"

repo="${HERMES_UPSTREAM_REPO:-$TRUSTED_REPO}"
tag="${HERMES_UPSTREAM_TAG:-$DEFAULT_TAG}"
commit="${HERMES_UPSTREAM_COMMIT:-$DEFAULT_COMMIT}"
version="${HERMES_UPSTREAM_VERSION:-$DEFAULT_VERSION}"
release_root="${HERMES_UPSTREAM_ROOT:-/opt/d3vonn/hermes-upstream}"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

[[ "$repo" == "$TRUSTED_REPO" ]] || die "HERMES_UPSTREAM_REPO must be $TRUSTED_REPO"
[[ "$tag" =~ ^v[0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2}$ ]] || die "invalid release tag: $tag"
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || die "HERMES_UPSTREAM_COMMIT must be a full lowercase SHA-1"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "invalid semantic version: $version"
[[ "$release_root" == /* ]] || die "HERMES_UPSTREAM_ROOT must be an absolute path"

command -v git >/dev/null || die "git is required"
command -v uv >/dev/null || die "uv is required"
command -v python3 >/dev/null || die "python3 is required"

releases_dir="$release_root/releases"
release_dir="$releases_dir/$commit"
source_dir="$release_dir/source"
venv_dir="$release_dir/venv"
config_home=""
release_created=0

cleanup() {
  local status=$?
  if [[ -n "$config_home" && -d "$config_home" ]]; then
    rm -rf -- "$config_home"
  fi
  if [[ $status -ne 0 && $release_created -eq 1 && -d "$release_dir" ]]; then
    rm -rf -- "$release_dir"
  fi
}
trap cleanup EXIT

mkdir -p -- "$releases_dir"
[[ ! -e "$release_dir" ]] || die "release already exists: $release_dir"
mkdir -- "$release_dir"
release_created=1

git clone --quiet --depth 1 --branch "$tag" -- "$repo" "$source_dir"
resolved_commit="$(git -C "$source_dir" rev-parse HEAD)"
[[ "$resolved_commit" == "$commit" ]] || die "tag $tag resolved to $resolved_commit, expected $commit"

[[ -f "$source_dir/uv.lock" ]] || die "upstream uv.lock is missing"
resolved_version="$(python3 - "$source_dir/pyproject.toml" <<'PY'
import sys
import tomllib

with open(sys.argv[1], "rb") as handle:
    print(tomllib.load(handle)["project"]["version"])
PY
)"
[[ "$resolved_version" == "$version" ]] || die "pyproject version is $resolved_version, expected $version"

# Follow upstream's hash-verified installation tier. Editable pip-style
# installation is intentionally avoided because it re-resolves outside the lock.
UV_PROJECT_ENVIRONMENT="$venv_dir" uv sync --project "$source_dir" --extra all --locked

installed_version="$("$venv_dir/bin/python" -c 'from hermes_cli import __version__; print(__version__)')"
[[ "$installed_version" == "$version" ]] || die "installed CLI version is $installed_version, expected $version"
timeout 30 "$venv_dir/bin/hermes" --version | grep -F "Hermes Agent v$version" >/dev/null

# Keep configuration inspection isolated from the operator's real Hermes profile.
config_home="$(mktemp -d "$release_root/.config-check.XXXXXX")"
HERMES_HOME="$config_home" timeout 30 "$venv_dir/bin/hermes" config check >/dev/null

lock_sha256="$(python3 - "$source_dir/uv.lock" <<'PY'
import hashlib
import sys

with open(sys.argv[1], "rb") as handle:
    print(hashlib.file_digest(handle, "sha256").hexdigest())
PY
)"
python3 - "$release_dir/release.json" "$repo" "$tag" "$commit" "$version" "$lock_sha256" <<'PY'
import json
import sys

path, repo, tag, commit, version, lock_sha256 = sys.argv[1:]
with open(path, "w", encoding="utf-8") as handle:
    json.dump(
        {
            "repository": repo,
            "tag": tag,
            "commit": commit,
            "version": version,
            "uv_lock_sha256": lock_sha256,
            "state": "staged",
        },
        handle,
        indent=2,
        sort_keys=True,
    )
    handle.write("\n")
PY

staged_link="$release_root/.staged.$commit"
ln -s -- "$release_dir" "$staged_link"
mv -Tf -- "$staged_link" "$release_root/staged"
release_created=0

printf 'Hermes Agent %s staged at %s\n' "$version" "$release_dir"
printf 'Production was not activated; no service was restarted and `current` was not changed.\n'
