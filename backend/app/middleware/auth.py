"""
Devonn.ai Backend Proxy — Auth Middleware
Verifies Supabase JWT tokens from the Authorization header.
Provides a FastAPI dependency: get_current_user_id
"""
import logging
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.config import get_settings

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)
Settings = get_settings


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """
    FastAPI dependency that validates a Supabase JWT and returns the user ID.
    Raises HTTP 401 if the token is missing or invalid.
    """
    settings = get_settings()

    if not settings.require_auth:
        # Dev mode — skip auth, return a placeholder user ID
        return "dev-user"

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Validate JWT with Supabase Auth API
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_service_role_key,
                },
            )
    except httpx.RequestError as exc:
        logger.error("Supabase auth request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth service unavailable",
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_data = resp.json()
    user_id: str = user_data.get("id", "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not extract user ID from token",
        )

    return user_id
