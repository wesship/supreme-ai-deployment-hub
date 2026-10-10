#!/usr/bin/env python3
"""
propose_fixes.py — Devonn.AI Autonomous Fix Engine

This script is invoked by the GitHub Actions auto-fix.yml workflow.
It uses the OpenAI API to analyze CI failures and propose code fixes
as pull requests.

Usage:
    python scripts/ai/propose_fixes.py --issue-body "description of the issue"

Environment variables required:
    OPENAI_API_KEY  — OpenAI API key
    GH_TOKEN        — GitHub token with contents:write and pull-requests:write
"""

import argparse
import os
import sys
import subprocess
import json
from datetime import datetime

# ── Dependency check ──────────────────────────────────────────────────────────
try:
    from openai import OpenAI
except ImportError:
    print("ERROR: openai package not installed. Run: pip install openai")
    sys.exit(1)


def get_recent_ci_failures() -> str:
    """Collect recent git log and any test output for context."""
    try:
        log = subprocess.check_output(
            ["git", "log", "--oneline", "-10"],
            text=True, stderr=subprocess.DEVNULL
        )
        return log
    except subprocess.CalledProcessError:
        return "Could not retrieve git log."


def propose_fix(issue_body: str) -> str:
    """
    Call the OpenAI API to propose a fix for the given issue.
    Returns a markdown-formatted description of the proposed changes.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("ERROR: OPENAI_API_KEY environment variable is not set.")
        sys.exit(1)

    client = OpenAI(api_key=api_key)

    recent_commits = get_recent_ci_failures()

    system_prompt = """You are an expert software engineer working on the Devonn.AI
repository (supreme-ai-deployment-hub). Your job is to analyze CI failures and
propose minimal, targeted code fixes. Always:
1. Identify the root cause precisely.
2. Propose the smallest possible change that fixes the issue.
3. Explain the fix clearly in the PR description.
4. Never introduce new dependencies unless absolutely necessary."""

    user_message = f"""Recent git history:
{recent_commits}

Issue/failure description:
{issue_body}

Please analyze this and propose a specific fix. Format your response as:
## Root Cause
[explanation]

## Proposed Fix
[specific file changes with before/after code snippets]

## PR Description
[ready-to-use PR title and body]"""

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        max_tokens=2000,
        temperature=0.2
    )

    return response.choices[0].message.content


def create_fix_branch(fix_description: str) -> str:
    """Create a new branch for the proposed fix."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    branch_name = f"auto-fix/ai-proposed-{timestamp}"

    subprocess.run(["git", "checkout", "-b", branch_name], check=True)
    print(f"Created branch: {branch_name}")
    return branch_name


def main():
    parser = argparse.ArgumentParser(description="Devonn.AI Autonomous Fix Engine")
    parser.add_argument(
        "--issue-body",
        required=True,
        help="Description of the issue or CI failure to fix"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the proposed fix without creating a PR"
    )
    args = parser.parse_args()

    print(f"Analyzing issue: {args.issue_body[:100]}...")

    # Get AI-proposed fix
    fix = propose_fix(args.issue_body)
    print("\n=== Proposed Fix ===")
    print(fix)

    if args.dry_run:
        print("\nDry run mode — no PR created.")
        return

    # Write the fix proposal to a file for review
    proposal_path = "auto-fix-proposal.md"
    with open(proposal_path, "w") as f:
        f.write(f"# Auto-Fix Proposal\n\n")
        f.write(f"**Generated:** {datetime.now().isoformat()}\n\n")
        f.write(f"**Issue:** {args.issue_body}\n\n")
        f.write(fix)

    # Commit the proposal file
    subprocess.run(["git", "add", proposal_path], check=True)
    subprocess.run(
        ["git", "commit", "-m", f"chore(auto-fix): AI-proposed fix for CI failure"],
        check=True
    )

    branch = subprocess.check_output(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"], text=True
    ).strip()

    subprocess.run(["git", "push", "origin", branch], check=True)
    print(f"\nPushed proposal to branch: {branch}")
    print("Create a PR from this branch to review the proposed fix.")


if __name__ == "__main__":
    main()
