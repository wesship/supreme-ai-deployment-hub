from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header

from backend.auth.supabase_jwt import _extract_bearer_token, _get_authenticated_user


@dataclass(frozen=True)
class ClientAIPrincipal:
    user_id: str
    email: str | None


async def require_client_ai_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> ClientAIPrincipal:
    """Authenticate a normal Supabase user without requiring OCC/admin roles."""
    token = _extract_bearer_token(authorization)
    user = await _get_authenticated_user(token)
    email_value = user.get("email")
    return ClientAIPrincipal(
        user_id=str(user["id"]),
        email=email_value.strip().lower() if isinstance(email_value, str) else None,
    )


ClientAIUser = Annotated[ClientAIPrincipal, Depends(require_client_ai_user)]
