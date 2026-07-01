"""
backend/auth/jwt.py — JWT authentication utilities for Devonn.AI FastAPI backend.

Usage:
    from auth.jwt import verify_jwt, create_jwt

    # Verify an incoming Bearer token
    payload = verify_jwt("Bearer eyJ...")

    # Create a new JWT (for testing / service-to-service)
    token = create_jwt({"sub": "user-123", "email": "user@d3vonn.io"})
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import jwt as pyjwt
from fastapi import HTTPException, status

JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))


def _get_jwt_secret() -> str:
    """Return the configured JWT secret or fail safely."""
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is required and must be configured in the runtime environment")
    return secret


def verify_jwt(authorization: str) -> Dict[str, Any]:
    """
    Verify a Bearer JWT token and return its decoded payload.

    Args:
        authorization: The raw Authorization header value, e.g. "Bearer eyJ..."

    Returns:
        Decoded JWT payload as a dict.

    Raises:
        HTTPException(401): If the token is missing, malformed, expired, or invalid.
        HTTPException(500): If JWT_SECRET is missing from the runtime environment.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header. Expected: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = pyjwt.decode(
            token,
            _get_jwt_secret(),
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        return payload
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service is not configured",
        ) from exc
    except pyjwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except pyjwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def create_jwt(
    payload: Dict[str, Any],
    expiry_hours: int = JWT_EXPIRY_HOURS,
) -> str:
    """
    Create a signed JWT token.

    Args:
        payload: Claims to include in the token. Must contain "sub".
        expiry_hours: Token lifetime in hours (default: JWT_EXPIRY_HOURS env var).

    Returns:
        Signed JWT string.
    """
    now = datetime.now(timezone.utc)
    claims = {
        **payload,
        "iat": now,
        "exp": now + timedelta(hours=expiry_hours),
    }
    return pyjwt.encode(claims, _get_jwt_secret(), algorithm=JWT_ALGORITHM)
