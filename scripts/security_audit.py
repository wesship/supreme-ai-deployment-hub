#!/usr/bin/env python3
"""
scripts/security_audit.py — Devonn.AI Phase 4 Security Audit

Automatically verifies all six security requirements from the Phase 4 scope:
  1. No key echo — key values are never returned in API responses
  2. No plaintext logs — key values are never written to log output
  3. RLS enabled — Supabase migration includes RLS policies
  4. Auth required in production — REQUIRE_AUTH is enforced
  5. Non-root container — Dockerfile uses a non-root USER
  6. No secrets in image layers — Dockerfile does not embed secrets

Usage:
    python3 scripts/security_audit.py [--repo-root PATH]

Exit codes:
    0 — all checks passed
    1 — one or more checks failed
"""
from __future__ import annotations

import argparse
import ast
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

# ── Result tracking ───────────────────────────────────────────────────────────

@dataclass
class Results:
    passed: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)
    warned: list[str] = field(default_factory=list)

    def ok(self, msg: str) -> None:
        self.passed.append(msg)
        print("  \033[32m✓\033[0m check passed")

    def fail(self, msg: str) -> None:
        self.failed.append(msg)
        print("  \033[31m✗\033[0m check failed; details retained in memory only")

    def warn(self, msg: str) -> None:
        self.warned.append(msg)
        print("  \033[33m!\033[0m check warning; details retained in memory only")


# ── Helpers ───────────────────────────────────────────────────────────────────

def read(path: Path) -> str:
    try:
        return path.read_text(errors="replace")
    except Exception:
        return ""


def py_files(root: Path) -> list[Path]:
    return [
        p for p in root.rglob("*.py")
        if ".venv" not in str(p) and "__pycache__" not in str(p)
        and "node_modules" not in str(p)
    ]


# ── Audit checks ──────────────────────────────────────────────────────────────

def check_no_key_echo(repo: Path, r: Results) -> None:
    """
    Check 1: Key values must never be returned in API response models.
    The vault router must not include 'value' in any response model.
    """
    print("\n[ 1 ] No key echo — vault responses must never include key values")
    vault_router = repo / "backend" / "app" / "routers" / "proxy_vault.py"
    if not vault_router.exists():
        r.fail("proxy_vault.py not found")
        return

    src = read(vault_router)

    # Response models must not have a 'value' field
    response_models = re.findall(r"class \w+Response\(BaseModel\):(.*?)(?=\nclass |\Z)", src, re.DOTALL)
    for model_body in response_models:
        if re.search(r"^\s+value\s*:", model_body, re.MULTILINE):
            r.fail("Response model contains a 'value' field — key values may be echoed in API responses")
            return

    # The list endpoint must not return vault values
    if "vault[" in src and "return vault" in src:
        r.fail("vault dict may be returned directly — key values could be exposed")
        return

    r.ok("No response model exposes key values")

    # Confirm the store endpoint stores but does not return the value
    if re.search(r"StoreKeyResponse.*value=body\.value", src, re.DOTALL):
        r.fail("StoreKeyResponse includes the raw key value in the response")
    else:
        r.ok("StoreKeyResponse does not echo the key value")


def check_no_plaintext_logs(repo: Path, r: Results) -> None:
    """
    Check 2: Key values must never appear in log statements.
    Scans all Python files for log calls that reference body.value or key values.
    """
    print("\n[ 2 ] No plaintext logs — key values must not be logged")
    dangerous_patterns = [
        (r"log.*body\.value", "body.value passed to a log call"),
        (r"logger\.\w+\(.*body\.value", "body.value in logger call"),
        (r"print\(.*body\.value", "body.value in print call"),
        (r"log.*key_value", "key_value field passed to a log call"),
    ]

    violations: list[str] = []
    for pyfile in py_files(repo / "backend"):
        src = read(pyfile)
        for pattern, desc in dangerous_patterns:
            if re.search(pattern, src, re.IGNORECASE):
                violations.append(f"{pyfile.relative_to(repo)}: {desc}")

    if violations:
        for v in violations:
            r.fail(v)
    else:
        r.ok("No log statements reference key values or body.value")

    # Confirm audit_log.py explicitly documents the no-value invariant
    audit_log = repo / "backend" / "app" / "observability" / "audit_log.py"
    if audit_log.exists():
        src = read(audit_log)
        if "never" in src.lower() and ("value" in src.lower() or "log" in src.lower()):
            r.ok("audit_log.py documents the no-value-logging invariant")
        else:
            r.warn("audit_log.py does not explicitly document the no-value-logging invariant")
    else:
        r.warn("audit_log.py not found — observability module missing")


def check_rls_enabled(repo: Path, r: Results) -> None:
    """
    Check 3: Supabase migration must enable RLS on api_key_vault.
    """
    print("\n[ 3 ] RLS enabled — Supabase migration must include RLS policies")
    migrations_dir = repo / "supabase" / "migrations"
    if not migrations_dir.exists():
        r.fail("supabase/migrations directory not found")
        return

    vault_migrations = sorted(migrations_dir.glob("*api_key_vault*"))
    if not vault_migrations:
        r.fail("No api_key_vault migration found in supabase/migrations/")
        return

    migration = vault_migrations[-1]
    src = read(migration).upper()

    checks = [
        ("ENABLE ROW LEVEL SECURITY", "RLS enabled on api_key_vault"),
        ("CREATE POLICY", "At least one RLS policy defined"),
        ("USING (AUTH.UID()", "Policy uses auth.uid() for row isolation"),
    ]
    for pattern, desc in checks:
        if pattern in src:
            r.ok(f"{migration.name}: {desc}")
        else:
            r.fail(f"{migration.name}: missing — {desc}")


def check_auth_required(repo: Path, r: Results) -> None:
    """
    Check 4: Auth must be required in production.
    Verifies that all proxy-vault routes use get_current_user_id as a dependency.
    """
    print("\n[ 4 ] Auth required — all vault routes must enforce authentication")
    vault_router = repo / "backend" / "app" / "routers" / "proxy_vault.py"
    if not vault_router.exists():
        r.fail("proxy_vault.py not found")
        return

    src = read(vault_router)
    routes = re.findall(r"@router\.(get|post|delete|put|patch)\(['\"]([^'\"]+)['\"]", src)
    for method, path in routes:
        # Find the function definition after this decorator
        pattern = rf"@router\.{method}\(['\"]" + re.escape(path) + r"['\"].*?async def \w+\([^)]*\)"
        match = re.search(pattern, src, re.DOTALL)
        if match:
            func_sig = match.group(0)
            if "get_current_user_id" in func_sig or "Depends(get_current_user_id)" in func_sig:
                r.ok(f"{method.upper()} {path} — auth dependency present")
            else:
                r.fail(f"{method.upper()} {path} — missing get_current_user_id dependency")
        else:
            r.warn(f"{method.upper()} {path} — could not verify auth dependency (check manually)")

    # Verify REQUIRE_AUTH is checked in the auth middleware
    auth_mw = repo / "backend" / "app" / "middleware" / "auth.py"
    if auth_mw.exists():
        src = read(auth_mw)
        if "require_auth" in src:
            r.ok("auth middleware checks require_auth setting")
        else:
            r.fail("auth middleware does not check require_auth — auth may not be enforced in production")
    else:
        r.fail("auth.py middleware not found")


def check_non_root_container(repo: Path, r: Results) -> None:
    """
    Check 5: Dockerfile must use a non-root USER.
    """
    print("\n[ 5 ] Non-root container — Dockerfile must not run as root")
    dockerfiles = [
        repo / "Dockerfile.railway",
        repo / "backend" / "Dockerfile",
        repo / "Dockerfile",
    ]

    for df in dockerfiles:
        if not df.exists():
            continue
        src = read(df)
        user_lines = re.findall(r"^USER\s+(.+)$", src, re.MULTILINE)
        if not user_lines:
            r.fail(f"{df.name}: no USER instruction found — container runs as root")
        else:
            last_user = user_lines[-1].strip()
            if last_user in ("root", "0"):
                r.fail(f"{df.name}: USER is set to root ({last_user})")
            else:
                r.ok(f"{df.name}: runs as non-root user '{last_user}'")


def check_no_secrets_in_layers(repo: Path, r: Results) -> None:
    """
    Check 6: Dockerfile must not embed secrets in image layers.
    Checks for ENV instructions that set secret-like values, and for
    ARG/ENV patterns that bake secrets into layers.
    """
    print("\n[ 6 ] No secrets in image layers — Dockerfile must not embed secrets")
    dockerfiles = [
        repo / "Dockerfile.railway",
        repo / "backend" / "Dockerfile",
        repo / "Dockerfile",
    ]

    secret_patterns = [
        (r"^ENV\s+(API_KEY|SECRET|PASSWORD|TOKEN|KEY)\s*=\s*\S+", "ENV instruction sets a secret-like variable"),
        (r"^ARG\s+(API_KEY|SECRET|PASSWORD|TOKEN|KEY)\s*=\s*\S+", "ARG instruction with default secret value"),
        (r"sk-[a-zA-Z0-9]{20,}", "Possible OpenAI API key embedded in Dockerfile"),
        (r"eyJ[a-zA-Z0-9_-]{20,}", "Possible JWT token embedded in Dockerfile"),
    ]

    for df in dockerfiles:
        if not df.exists():
            continue
        src = read(df)
        found_issues = False
        for pattern, desc in secret_patterns:
            if re.search(pattern, src, re.MULTILINE | re.IGNORECASE):
                r.fail(f"{df.name}: {desc}")
                found_issues = True
        if not found_issues:
            r.ok(f"{df.name}: no secrets embedded in image layers")

    # Check that .dockerignore exists and excludes .env files
    dockerignore = repo / ".dockerignore"
    if dockerignore.exists():
        src = read(dockerignore)
        if ".env" in src or "*.env" in src:
            r.ok(".dockerignore excludes .env files")
        else:
            r.warn(".dockerignore does not explicitly exclude .env files")
    else:
        r.warn(".dockerignore not found — .env files may be copied into the image")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Devonn.AI Phase 4 Security Audit")
    parser.add_argument("--repo-root", default=".", help="Path to the repository root")
    args = parser.parse_args()

    repo = Path(args.repo_root).resolve()
    r = Results()

    print()
    print("╔══════════════════════════════════════════════════════╗")
    print("║       Devonn.AI Security Audit — Phase 4             ║")
    print("╚══════════════════════════════════════════════════════╝")
    print(f"  Repository: {repo}")

    check_no_key_echo(repo, r)
    check_no_plaintext_logs(repo, r)
    check_rls_enabled(repo, r)
    check_auth_required(repo, r)
    check_non_root_container(repo, r)
    check_no_secrets_in_layers(repo, r)

    print()
    print("──────────────────────────────────────────────────────")
    print(f"  \033[32mPassed:\033[0m   {len(r.passed)}")
    print(f"  \033[33mWarnings:\033[0m {len(r.warned)}")
    print(f"  \033[31mFailed:\033[0m   {len(r.failed)}")
    print("──────────────────────────────────────────────────────")
    print()

    if r.failed:
        print(f"\033[31mSECURITY AUDIT FAILED — {len(r.failed)} check(s) did not pass.\033[0m")
        sys.exit(1)
    else:
        print("\033[32mSECURITY AUDIT PASSED\033[0m")
        if r.warned:
            print(f"  {len(r.warned)} warning(s) — review above for details.")
        sys.exit(0)


if __name__ == "__main__":
    main()
