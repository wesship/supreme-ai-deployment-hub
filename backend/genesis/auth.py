"""Authentication helpers for Genesis project APIs.

Genesis endpoints accept any valid Supabase user token. Project-level authorization is
then enforced by repository access checks and database RLS.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Header, HTTPException, status

from backend.auth.supabase_jwt import _extract_bearer_token, _get_authenticated_user


@dataclass(frozen=True)
class GenesisPrincipal:
    user_id: str
    email: str | None
    access_token: str


async def require_genesis_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> GenesisPrincipal:
    token = _extract_bearer_token(authorization)
    user: dict[str, Any] = await _get_authenticated_user(token)
    user_id = str(user.get("id") or "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not resolve authenticated Genesis user.",
        )
    email_value = user.get("email")
    email = email_value if isinstance(email_value, str) else None
    return GenesisPrincipal(user_id=user_id, email=email, access_token=token)
