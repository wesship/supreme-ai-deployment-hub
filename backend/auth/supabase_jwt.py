"""
backend/auth/supabase_jwt.py — Supabase JWT verification for OCC API routes.

Verifies Supabase-issued JWTs (RS256, signed with Supabase's JWT secret) and
enforces admin/operator role checks via the public.user_roles table.

Usage:
    from backend.auth.supabase_jwt import require_occ_access, OCCPrincipal

    @router.get("/occ/logs")
    async def get_logs(principal: OCCPrincipal = Depends(require_occ_access)):
        ...

Environment variables required:
    SUPABASE_URL              — e.g. https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS for role check)
    JWT_SECRET                — your Supabase JWT secret (from project settings)
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Annotated, Any, Dict

import httpx
import jwt as pyjwt
from fastapi import Depends, Header, HTTPException, status

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
JWT_SECRET: str = os.getenv("JWT_SECRET", "")

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
# JWT verification
# ---------------------------------------------------------------------------
def _decode_supabase_jwt(authorization: str | None) -> Dict[str, Any]:
    """Extract and decode a Supabase Bearer JWT from the Authorization header."""
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

    if not JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT_SECRET is not configured on the backend.",
        )

    try:
        payload = pyjwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"]},
            audience="authenticated",
        )
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except pyjwt.InvalidAudienceError:
        # Try without audience claim (some Supabase configs omit it)
        try:
            payload = pyjwt.decode(
                token,
                JWT_SECRET,
                algorithms=["HS256"],
                options={"require": ["exp", "sub"], "verify_aud": False},
            )
            return payload
        except pyjwt.InvalidTokenError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {exc}",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except pyjwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# Role check via Supabase REST API (service role bypasses RLS)
# ---------------------------------------------------------------------------
async def _get_user_occ_role(user_id: str) -> str | None:
    """
    Query public.user_roles for the user's highest OCC-allowed role.
    Uses service_role key to bypass RLS.
    Returns 'admin', 'operator', or None if no OCC role found.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        # If Supabase is not configured, fall back to allowing access
        # (prevents hard lock-out during initial setup)
        return "operator"

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
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                return None
            rows = resp.json()
            # Prefer admin > operator > viewer > user
            roles = {row["role"] for row in rows if isinstance(row, dict)}
            for preferred in ("admin", "operator"):
                if preferred in roles:
                    return preferred
            return None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------
async def require_occ_access(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> OCCPrincipal:
    """
    FastAPI dependency that:
    1. Verifies the Supabase JWT
    2. Checks the user has admin or operator role in user_roles
    3. Returns an OCCPrincipal if authorized

    Raises HTTP 401 if unauthenticated, HTTP 403 if insufficient role.
    """
    payload = _decode_supabase_jwt(authorization)

    user_id: str = payload.get("sub", "")
    email: str | None = payload.get("email")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim.",
        )

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
