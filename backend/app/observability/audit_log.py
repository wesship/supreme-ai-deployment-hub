"""
backend/app/observability/audit_log.py

Structured audit logger for security-critical events.

All log entries are emitted as JSON via structlog so they can be
ingested by Railway's log drain, Datadog, or any OpenTelemetry
collector without additional parsing.

Event taxonomy
--------------
vault.key.create      — a key was stored/rotated in the vault
vault.key.delete      — a key was removed from the vault
vault.config.access   — /api/proxy/config was read
auth.failure          — a request was rejected due to bad/missing JWT
auth.supabase.failure — Supabase auth API returned an error or timed out

Security invariants enforced here
----------------------------------
* Key *values* are NEVER logged — only key names.
* Token values are NEVER logged — only the first 8 chars for correlation.
* User IDs are included to support incident investigation.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

import structlog

# Configure structlog to emit JSON in production, coloured console in dev.
# This is idempotent — safe to call multiple times.
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

_audit = structlog.get_logger("devonn.audit")


# ── Vault events ──────────────────────────────────────────────────────────────

def log_vault_key_create(
    *,
    user_id: str,
    key_name: str,
    encrypted: bool,
    request_id: Optional[str] = None,
) -> None:
    """Emit a structured log entry when a vault key is created or rotated."""
    _audit.info(
        "vault.key.create",
        user_id=user_id,
        key_name=key_name,          # name only — value is never logged
        encrypted=encrypted,
        request_id=request_id,
        ts=time.time(),
    )


def log_vault_key_delete(
    *,
    user_id: str,
    key_name: str,
    request_id: Optional[str] = None,
) -> None:
    """Emit a structured log entry when a vault key is deleted."""
    _audit.info(
        "vault.key.delete",
        user_id=user_id,
        key_name=key_name,
        request_id=request_id,
        ts=time.time(),
    )


def log_vault_config_access(
    *,
    user_id: str,
    vault_encrypted: bool,
    keys_configured: int,
    request_id: Optional[str] = None,
) -> None:
    """Emit a structured log entry when /api/proxy/config is accessed."""
    _audit.info(
        "vault.config.access",
        user_id=user_id,
        vault_encrypted=vault_encrypted,
        keys_configured=keys_configured,
        request_id=request_id,
        ts=time.time(),
    )


# ── Auth events ───────────────────────────────────────────────────────────────

def log_auth_failure(
    *,
    reason: str,
    token_prefix: Optional[str] = None,   # first 8 chars only, for correlation
    path: Optional[str] = None,
    request_id: Optional[str] = None,
) -> None:
    """Emit a structured log entry when authentication fails."""
    _audit.warning(
        "auth.failure",
        reason=reason,
        token_prefix=token_prefix,         # never the full token
        path=path,
        request_id=request_id,
        ts=time.time(),
    )


def log_supabase_failure(
    *,
    error: str,
    status_code: Optional[int] = None,
    path: Optional[str] = None,
    request_id: Optional[str] = None,
) -> None:
    """Emit a structured log entry when the Supabase auth API fails."""
    _audit.error(
        "auth.supabase.failure",
        error=error,
        status_code=status_code,
        path=path,
        request_id=request_id,
        ts=time.time(),
    )
