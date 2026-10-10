"""
Devonn.ai Backend Proxy — Auth Middleware
Verifies Supabase JWT tokens from the Authorization header.
Provides a FastAPI dependency: get_current_user_id

All authentication failures and Supabase connectivity issues emit
structured audit log entries via backend.app.observability.audit_log.
Token values are never logged — only the first 8 characters are
included for incident correlation.
"""
import logging
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.config import get_settings
from backend.app.observability.audit_log import log_auth_failure, log_supabase_failure

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)
Settings = get_settings


async def get_current_user_id(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """
    FastAPI dependency that validates a Supabase JWT and returns the user ID.
    Raises HTTP 401 if the token is missing or invalid.
    Raises HTTP 503 if the Supabase auth API is unreachable.
    """
    settings = get_settings()
    request_id: Optional[str] = (
        request.headers.get("x-request-id")
        or request.headers.get("x-railway-request-id")
    )
    path: str = request.url.path

    if not settings.require_auth:
        # Dev mode — skip auth, return a placeholder user ID
        return "dev-user"

    if credentials is None:
        log_auth_failure(
            reason="missing_authorization_header",
            path=path,
            request_id=request_id,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    # Only log the first 8 chars for correlation — never the full token
    token_prefix = token[:8] if token else None

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
        log_supabase_failure(
            error=str(exc),
            path=path,
            request_id=request_id,
        )
        logger.error("Supabase auth request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth service unavailable",
        )

    if resp.status_code != 200:
        log_auth_failure(
            reason="invalid_or_expired_token",
            token_prefix=token_prefix,
            path=path,
            request_id=request_id,
        )
        log_supabase_failure(
            error=f"Supabase returned HTTP {resp.status_code}",
            status_code=resp.status_code,
            path=path,
            request_id=request_id,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_data = resp.json()
    user_id: str = user_data.get("id", "")
    if not user_id:
        log_auth_failure(
            reason="missing_user_id_in_token",
            token_prefix=token_prefix,
            path=path,
            request_id=request_id,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not extract user ID from token",
        )

    return user_id
