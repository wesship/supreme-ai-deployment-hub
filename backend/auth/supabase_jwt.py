"""
backend/auth/supabase_jwt.py — Supabase authentication for OCC API routes.

Validates Supabase-issued access tokens against the authoritative Auth API and
enforces admin/operator role checks through the public.user_roles table.
This remains compatible with projects using symmetric or asymmetric JWT signing.

Usage:
    from backend.auth.supabase_jwt import require_occ_access, OCCPrincipal

    @router.get("/occ/logs")
    async def get_logs(principal: OCCPrincipal = Depends(require_occ_access)):
        ...

Environment variables required:
    SUPABASE_URL              — e.g. https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY — service role key for Auth and role lookup
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Annotated, Any

import httpx
from fastapi import Depends, Header, HTTPException, status

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Roles that are allowed to access OCC endpoints
OCC_ALLOWED_ROLES: frozenset[str] = frozenset({"admin", "operator"})


# ---------------------------------------------------------------------------
# Principal dataclass
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class OCCPrincipal:
    user_id: str
    email: str | None
    role: str  # 'admin' | 'operator'


# ---------------------------------------------------------------------------
# Authoritative Supabase token verification
# ---------------------------------------------------------------------------
def _extract_bearer_token(authorization: str | None) -> str:
    """Extract a non-empty Bearer token or raise HTTP 401."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header. Expected: Bearer <supabase_jwt>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token


async def _get_authenticated_user(token: str) -> dict[str, Any]:
    """Validate the access token through Supabase Auth and return its user."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase authentication is not configured on the backend.",
        )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                },
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase authentication service is unavailable.",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = response.json()
    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not extract user identity from token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# ---------------------------------------------------------------------------
# Role check via Supabase REST API (service role bypasses RLS)
# ---------------------------------------------------------------------------
async def _get_user_occ_role(user_id: str) -> str | None:
    """
    Query public.user_roles for the user's highest OCC-allowed role.
    Uses service_role key to bypass RLS.
    Returns 'admin', 'operator', or None if no OCC role is found.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OCC role authorization is not configured on the backend.",
        )

    url = f"{SUPABASE_URL}/rest/v1/user_roles"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    params = {
        "user_id": f"eq.{user_id}",
        "select": "role",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, headers=headers, params=params)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OCC role store is unavailable.",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OCC role store returned an unexpected response.",
        )

    rows = response.json()
    roles = {
        row.get("role")
        for row in rows
        if isinstance(row, dict) and isinstance(row.get("role"), str)
    }
    for preferred in ("admin", "operator"):
        if preferred in roles:
            return preferred
    return None


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------
async def require_occ_access(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> OCCPrincipal:
    """
    1. Validates the Supabase access token through Supabase Auth.
    2. Checks the user has an admin or operator role in user_roles.
    3. Returns an OCCPrincipal if authorized.

    Raises HTTP 401 if unauthenticated, HTTP 403 if the role is insufficient,
    and HTTP 503 when the authoritative auth or role services are unavailable.
    """
    token = _extract_bearer_token(authorization)
    user = await _get_authenticated_user(token)

    user_id = str(user.get("id", ""))
    email_value = user.get("email")
    email = email_value if isinstance(email_value, str) else None

    role = await _get_user_occ_role(user_id)
    if role not in OCC_ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access OCC endpoints. "
                   "Admin or operator role required.",
        )

    return OCCPrincipal(user_id=user_id, email=email, role=role)


# Convenience type alias for route signatures
OCCAccess = Annotated[OCCPrincipal, Depends(require_occ_access)]
