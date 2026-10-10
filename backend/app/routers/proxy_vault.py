"""
backend/app/routers/proxy_vault.py — Proxy Config & API Key Vault Router

Exposes:
  GET    /api/proxy/config              — config surface (auth required)
  GET    /api/proxy/vault/keys          — list key names (no values)
  POST   /api/proxy/vault/keys          — store / rotate a key
  DELETE /api/proxy/vault/keys/{name}   — remove a key

The vault is backed by environment variables first, then an encrypted
JSON file at KEYS_FILE (default: .devonn/api-vault/keys.json).
API_KEY_VAULT_SECRET is the Fernet encryption key for the vault file.
If it is not set the vault operates in env-only / plaintext mode.

All mutating operations and config accesses emit structured audit log
entries via backend.app.observability.audit_log. Key *values* are
never logged.
"""
from __future__ import annotations

import base64
import json
import logging
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from ..middleware.auth import get_current_user_id
from ..observability.audit_log import (
    log_vault_config_access,
    log_vault_key_create,
    log_vault_key_delete,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/proxy", tags=["proxy-config"])

# ---------------------------------------------------------------------------
# Vault helpers
# ---------------------------------------------------------------------------
_VAULT_SECRET = os.getenv("API_KEY_VAULT_SECRET", "")
_KEYS_FILE = Path(os.getenv("KEYS_FILE", ".devonn/api-vault/keys.json"))


def _get_cipher():
    if not _VAULT_SECRET:
        return None
    try:
        from cryptography.fernet import Fernet  # type: ignore
        raw = _VAULT_SECRET.encode()
        try:
            key = base64.urlsafe_b64decode(raw + b"==")
            if len(key) != 32:
                raise ValueError("bad length")
        except Exception:
            key = raw
        return Fernet(base64.urlsafe_b64encode(key[:32]))
    except Exception as exc:
        logger.warning("Vault cipher init failed: %s", exc)
        return None


def _load_vault() -> dict[str, str]:
    try:
        if _KEYS_FILE.exists():
            return json.loads(_KEYS_FILE.read_text())
    except Exception as exc:
        logger.warning("Vault load error: %s", exc)
    return {}


def _save_vault(data: dict[str, str]) -> None:
    try:
        _KEYS_FILE.parent.mkdir(parents=True, exist_ok=True)
        _KEYS_FILE.write_text(json.dumps(data))
    except Exception as exc:
        logger.warning("Vault save error: %s", exc)


def _count_configured_keys() -> int:
    names: set[str] = set()
    for k in os.environ:
        if k.endswith("_API_KEY") or k.endswith("_SECRET"):
            names.add(k)
    names.update(_load_vault().keys())
    return len(names)


def _request_id(request: Request) -> str | None:
    """Extract the request ID from Railway / custom headers."""
    return (
        request.headers.get("x-request-id")
        or request.headers.get("x-railway-request-id")
    )


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class ProxyConfigResponse(BaseModel):
    mode: str
    status: str
    vaultPath: str
    keysConfigured: int
    vaultEncrypted: bool


class KeyListResponse(BaseModel):
    keys: list[str]
    total: int


class StoreKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, pattern=r"^[A-Z0-9_]+$")
    value: str = Field(..., min_length=1, max_length=4096)


class StoreKeyResponse(BaseModel):
    success: bool
    name: str
    encrypted: bool


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.get("/config", response_model=ProxyConfigResponse)
async def get_proxy_config(
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    """Return proxy/vault configuration metadata. Never exposes key values."""
    cipher = _get_cipher()
    keys_configured = _count_configured_keys()
    vault_encrypted = cipher is not None

    # Audit log — no sensitive data included
    log_vault_config_access(
        user_id=user_id,
        vault_encrypted=vault_encrypted,
        keys_configured=keys_configured,
        request_id=_request_id(request),
    )

    return ProxyConfigResponse(
        mode="env-first" if not _VAULT_SECRET else "vault",
        status="active",
        vaultPath=str(_KEYS_FILE),
        keysConfigured=keys_configured,
        vaultEncrypted=vault_encrypted,
    )


@router.get("/vault/keys", response_model=KeyListResponse)
async def list_vault_keys(user_id: str = Depends(get_current_user_id)):
    """List key names in the vault (no values returned)."""
    names: set[str] = set()
    for k in os.environ:
        if k.endswith("_API_KEY") or k.endswith("_SECRET"):
            names.add(k)
    names.update(_load_vault().keys())
    sorted_names = sorted(names)
    return KeyListResponse(keys=sorted_names, total=len(sorted_names))


@router.post("/vault/keys", response_model=StoreKeyResponse, status_code=status.HTTP_201_CREATED)
async def store_vault_key(
    body: StoreKeyRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    """Store or rotate an API key in the vault file. Value is never logged."""
    cipher = _get_cipher()
    vault = _load_vault()
    if cipher:
        vault[body.name] = cipher.encrypt(body.value.encode()).decode()
        encrypted = True
    else:
        logger.warning(
            "API_KEY_VAULT_SECRET not set — storing requested key in plaintext. "
            "Set API_KEY_VAULT_SECRET in Railway to enable encryption."
        )
        vault[body.name] = body.value
        encrypted = False
    _save_vault(vault)

    # Audit log — key name only, value is never included
    log_vault_key_create(
        user_id=user_id,
        key_name=body.name,
        encrypted=encrypted,
        request_id=_request_id(request),
    )

    return StoreKeyResponse(success=True, name=body.name, encrypted=encrypted)


@router.delete("/vault/keys/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vault_key(
    name: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    """Remove a key from the vault file."""
    vault = _load_vault()
    if name not in vault:
        raise HTTPException(status_code=404, detail=f"Key '{name}' not found in vault")
    del vault[name]
    _save_vault(vault)

    # Audit log
    log_vault_key_delete(
        user_id=user_id,
        key_name=name,
        request_id=_request_id(request),
    )
