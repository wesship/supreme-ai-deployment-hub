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

JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))


def verify_jwt(authorization: str) -> Dict[str, Any]:
    """
    Verify a Bearer JWT token and return its decoded payload.

    Args:
        authorization: The raw Authorization header value, e.g. "Bearer eyJ..."

    Returns:
        Decoded JWT payload as a dict.

    Raises:
        HTTPException(401): If the token is missing, malformed, expired, or invalid.
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
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except pyjwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


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
    return pyjwt.encode(claims, JWT_SECRET, algorithm=JWT_ALGORITHM)
