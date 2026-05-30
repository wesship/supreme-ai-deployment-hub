"""Operator API authentication and RBAC guard.

The guard is safe-by-default for production while remaining non-breaking during
stabilization. Set OPERATOR_AUTH_REQUIRED=true to enforce bearer token auth.

Supported initial mode:
- static bearer token via OPERATOR_API_TOKEN
- role claim via OPERATOR_ALLOWED_ROLES for future JWT expansion

No secrets are ever returned to callers.
"""

from __future__ import annotations

import hmac
import os
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status


@dataclass(frozen=True)
class OperatorPrincipal:
    subject: str
    role: str
    auth_mode: str


def auth_required() -> bool:
    return os.getenv("OPERATOR_AUTH_REQUIRED", "false").strip().lower() in {"1", "true", "yes", "on"}


def configured_token() -> str:
    return os.getenv("OPERATOR_API_TOKEN", "").strip()


def allowed_roles() -> set[str]:
    raw = os.getenv("OPERATOR_ALLOWED_ROLES", "admin,operator").strip()
    return {role.strip() for role in raw.split(",") if role.strip()}


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        return ""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        return ""
    return token.strip()


async def require_operator_access(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    x_operator_role: Annotated[str | None, Header(alias="X-Operator-Role")] = None,
) -> OperatorPrincipal:
    """Validate read-only Operator API access.

    Stabilization mode:
    - if OPERATOR_AUTH_REQUIRED is false, returns a local operator principal.

    Production mode:
    - requires OPERATOR_API_TOKEN
    - requires Authorization: Bearer <token>
    - optional X-Operator-Role must be in OPERATOR_ALLOWED_ROLES
    """
    if not auth_required():
        return OperatorPrincipal(subject="local-stabilization", role="operator", auth_mode="disabled")

    expected = configured_token()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Operator auth is required but OPERATOR_API_TOKEN is not configured.",
        )

    provided = _extract_bearer_token(authorization)
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Operator authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role = x_operator_role or "operator"
    if role not in allowed_roles():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operator role is not authorized.",
        )

    return OperatorPrincipal(subject="operator-api-token", role=role, auth_mode="static-bearer")


OperatorAccess = Annotated[OperatorPrincipal, Depends(require_operator_access)]
