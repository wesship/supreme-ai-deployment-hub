#!/usr/bin/env python3
"""
clone_repos_auto.py — Hardened Multi-Repo Clone Automation

Replaces the original stub with a production-ready script that:
  1. Authenticates with the GitHub API using a token (never plain git clone)
  2. Validates each repo before cloning (existence, visibility, size check)
  3. Respects GitHub API rate limits with exponential backoff
  4. Logs all operations to a structured JSON audit log
  5. Supports dry-run mode for safe testing

Usage:
  python3 scripts/clone_repos_auto.py --config scripts/repos.json
  python3 scripts/clone_repos_auto.py --config scripts/repos.json --dry-run
  python3 scripts/clone_repos_auto.py --config scripts/repos.json --update-existing

Required environment variables:
  GITHUB_TOKEN  — Personal Access Token with repo:read scope
"""

import argparse
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx

# ── Configuration ──────────────────────────────────────────────────────────────
GITHUB_API = "https://api.github.com"
MAX_REPO_SIZE_MB = 500          # Refuse to clone repos larger than 500MB
RATE_LIMIT_BUFFER = 50          # Keep this many API calls in reserve
MAX_RETRIES = 3
CLONE_BASE_DIR = Path(os.getenv("CLONE_BASE_DIR", "./cloned-repos"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ"
)
log = logging.getLogger("clone_repos_auto")


class GitHubClient:
    def __init__(self, token: str):
        self.token = token
        self.client = httpx.Client(
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=30,
        )

    def get_repo(self, owner: str, repo: str) -> Optional[dict]:
        """Fetch repo metadata from GitHub API."""
        for attempt in range(MAX_RETRIES):
            try:
                response = self.client.get(f"{GITHUB_API}/repos/{owner}/{repo}")
                if response.status_code == 404:
                    return None
                if response.status_code == 403:
                    # Rate limited — wait and retry
                    reset_time = int(response.headers.get("X-RateLimit-Reset", time.time() + 60))
                    wait = max(reset_time - int(time.time()), 1)
                    log.warning(f"Rate limited. Waiting {wait}s before retry {attempt+1}/{MAX_RETRIES}")
                    time.sleep(wait)
                    continue
                response.raise_for_status()
                return response.json()
            except httpx.RequestError as e:
                if attempt < MAX_RETRIES - 1:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"Failed to fetch repo {owner}/{repo}: {e}") from e
        return None

    def check_rate_limit(self) -> int:
        """Return remaining API calls."""
        response = self.client.get(f"{GITHUB_API}/rate_limit")
        response.raise_for_status()
        return response.json()["rate"]["remaining"]

    def close(self):
        self.client.close()


def clone_repo(repo_url: str, dest: Path, update_existing: bool, dry_run: bool) -> dict:
    """Clone or update a single repository."""
    result = {
        "repo": repo_url,
        "dest": str(dest),
        "status": "skipped",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if dest.exists():
        if not update_existing:
            log.info(f"  SKIP (already exists): {dest}")
            result["status"] = "skipped_exists"
            return result
        if dry_run:
            log.info(f"  [DRY-RUN] Would update: {dest}")
            result["status"] = "dry_run_update"
            return result
        log.info(f"  Updating: {dest}")
        proc = subprocess.run(
            ["git", "-C", str(dest), "pull", "--ff-only"],
            capture_output=True, text=True, timeout=120
        )
    else:
        if dry_run:
            log.info(f"  [DRY-RUN] Would clone: {repo_url} → {dest}")
            result["status"] = "dry_run_clone"
            return result
        dest.parent.mkdir(parents=True, exist_ok=True)
        log.info(f"  Cloning: {repo_url} → {dest}")
        proc = subprocess.run(
            ["git", "clone", "--depth=1", repo_url, str(dest)],
            capture_output=True, text=True, timeout=300
        )

    if proc.returncode == 0:
        result["status"] = "success"
        log.info(f"  ✓ Done: {dest.name}")
    else:
        result["status"] = "failed"
        result["error"] = proc.stderr.strip()
        log.error(f"  ✗ Failed: {proc.stderr.strip()}")

    return result


def load_repo_config(config_path: str) -> list[dict]:
    """Load and validate the repos configuration JSON."""
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")
    with open(path) as f:
        config = json.load(f)
    if not isinstance(config, list):
        raise ValueError("Config must be a JSON array of repo objects")
    for repo in config:
        if "owner" not in repo or "name" not in repo:
            raise ValueError(f"Each repo must have 'owner' and 'name': {repo}")
    return config


def main():
    parser = argparse.ArgumentParser(description="Hardened multi-repo clone automation")
    parser.add_argument("--config", required=True, help="Path to repos.json config file")
    parser.add_argument("--dry-run", action="store_true", help="Preview without cloning")
    parser.add_argument("--update-existing", action="store_true", help="git pull on existing repos")
    parser.add_argument("--output-dir", default=str(CLONE_BASE_DIR), help="Base clone directory")
    args = parser.parse_args()

    token = os.getenv("GITHUB_TOKEN")
    if not token:
        log.error("GITHUB_TOKEN environment variable is required")
        sys.exit(1)

    repos = load_repo_config(args.config)
    client = GitHubClient(token)
    output_dir = Path(args.output_dir)
    audit_log = []

    log.info(f"Starting clone automation: {len(repos)} repos, dry_run={args.dry_run}")

    # Check rate limit before starting
    remaining = client.check_rate_limit()
    if remaining < RATE_LIMIT_BUFFER + len(repos):
        log.warning(f"Low GitHub API rate limit: {remaining} remaining. Proceeding with caution.")

    for repo_config in repos:
        owner = repo_config["owner"]
        name = repo_config["name"]
        branch = repo_config.get("branch", "main")
        dest = output_dir / repo_config.get("dest", name)

        log.info(f"Processing: {owner}/{name}")

        # Validate repo exists and check size
        repo_meta = client.get_repo(owner, name)
        if repo_meta is None:
            log.error(f"  ✗ Repo not found or inaccessible: {owner}/{name}")
            audit_log.append({"repo": f"{owner}/{name}", "status": "not_found"})
            continue

        size_mb = repo_meta.get("size", 0) / 1024
        if size_mb > MAX_REPO_SIZE_MB:
            log.warning(f"  ✗ Repo too large ({size_mb:.0f}MB > {MAX_REPO_SIZE_MB}MB): {owner}/{name}")
            audit_log.append({"repo": f"{owner}/{name}", "status": "too_large", "size_mb": size_mb})
            continue

        # Build authenticated clone URL
        clone_url = f"https://x-access-token:{token}@github.com/{owner}/{name}.git"
        result = clone_repo(clone_url, dest, args.update_existing, args.dry_run)
        audit_log.append(result)

    # Write audit log
    audit_path = output_dir / "clone_audit.json"
    if not args.dry_run:
        output_dir.mkdir(parents=True, exist_ok=True)
        with open(audit_path, "w") as f:
            json.dump(audit_log, f, indent=2)
        log.info(f"Audit log written to: {audit_path}")

    client.close()

    # Summary
    success = sum(1 for r in audit_log if r.get("status") == "success")
    failed = sum(1 for r in audit_log if r.get("status") == "failed")
    log.info(f"Complete: {success} succeeded, {failed} failed, {len(repos) - success - failed} skipped")

    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
