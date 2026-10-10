#!/usr/bin/env python3
"""
clone_repos_auto.py — Clone or pull all repos for the Devonn.ai Auto-Healer Mesh.

Reads ORGANIZATION, WORKSPACE_DIR, GITHUB_TOKEN, and CLONE_PROTOCOL from the
environment (loaded by run_all.sh from .env).
"""
import os
import subprocess
import sys

ORGANIZATION = os.environ.get("ORGANIZATION", "wesship")
WORKSPACE_DIR = os.path.expanduser(os.environ.get("WORKSPACE_DIR", "~/DevonnAI_AutoHealer"))
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
CLONE_PROTOCOL = os.environ.get("CLONE_PROTOCOL", "https")

# Devonn ecosystem repos
REPOS = [
    "supreme-ai-deployment-hub",
    "central-orchestrator",
    "openclaw-gateway",
    "openclaw-macmini",
    "devonnaiwarroom",
    "Claw---Devonn",
    "openclaw",
    "devonn-autonomous-upgrade",
    "devonn-dashboard",
]


def repo_url(repo: str) -> str:
    if CLONE_PROTOCOL == "ssh":
        return f"git@github.com:{ORGANIZATION}/{repo}.git"
    token_prefix = f"{GITHUB_TOKEN}@" if GITHUB_TOKEN else ""
    return f"https://{token_prefix}github.com/{ORGANIZATION}/{repo}.git"


def clone_or_pull(repo: str) -> None:
    dest = os.path.join(WORKSPACE_DIR, repo)
    url = repo_url(repo)
    if os.path.isdir(os.path.join(dest, ".git")):
        print(f"  Pulling  {repo}...")
        subprocess.run(["git", "-C", dest, "pull", "--ff-only"], check=False)
    else:
        print(f"  Cloning  {repo}...")
        os.makedirs(WORKSPACE_DIR, exist_ok=True)
        subprocess.run(["git", "clone", "--depth=1", url, dest], check=False)


def main() -> None:
    print(f"Workspace: {WORKSPACE_DIR}")
    print(f"Org:       {ORGANIZATION}")
    print(f"Protocol:  {CLONE_PROTOCOL}")
    print(f"Repos:     {len(REPOS)}")
    print()
    for repo in REPOS:
        clone_or_pull(repo)
    print("\nAll repos ready.")


if __name__ == "__main__":
    main()
