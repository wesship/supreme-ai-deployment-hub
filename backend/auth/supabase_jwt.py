"""Supabase JWT verification and OCC role authorization."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Annotated, Any, Dict

import httpx
import jwt as pyjwt
from fastapi import Depends, Header, HTTPException, status

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
JWT_SECRET: str = os.getenv("JWT_SECRET", "")

OCC_ALLOWED_ROLES: frozenset[str] = frozenset({"admin", "operator"})


@dataclass(frozen=True)
class OCCPrincipal:
    user_id: str
    email: str | None
    role: str


def _decode_supabase_jwt(authorization: str | None) -> Dict[str, Any]:
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
        return pyjwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"]},
            audience="authenticated",
        )
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except pyjwt.InvalidAudienceError:
        try:
            return pyjwt.decode(
                token,
                JWT_SECRET,
                algorithms=["HS256"],
                options={"require": ["exp", "sub"], "verify_aud": False},
            )
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


async def _get_user_occ_role(user_id: str) -> str | None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OCC authorization is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
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
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                return None
            rows = resp.json()
            roles = {row["role"] for row in rows if isinstance(row, dict)}
            for preferred in ("admin", "operator"):
                if preferred in roles:
                    return preferred
            return None
    except HTTPException:
        raise
    except Exception:
        return None


async def require_occ_access(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> OCCPrincipal:
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
            detail="You do not have permission to access OCC endpoints. Admin or operator role required.",
        )

    return OCCPrincipal(user_id=user_id, email=email, role=role)


OCCAccess = Annotated[OCCPrincipal, Depends(require_occ_access)]
