"""
backend/app/observability

Structured audit logging and observability utilities for Devonn.AI.
"""
from .audit_log import (
    log_vault_key_create,
    log_vault_key_delete,
    log_vault_config_access,
    log_auth_failure,
    log_supabase_failure,
)

__all__ = [
    "log_vault_key_create",
    "log_vault_key_delete",
    "log_vault_config_access",
    "log_auth_failure",
    "log_supabase_failure",
]
