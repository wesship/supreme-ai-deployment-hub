"""
Authentication token utilities for API access.
"""
import os
from datetime import datetime, timedelta
from typing import Dict, Optional

import jwt
from fastapi import Depends, Header, HTTPException

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.environ.get("JWT_EXPIRATION_HOURS", "24"))


def _get_jwt_secret() -> str:
    """Return the configured JWT secret or fail safely."""
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is required and must be configured in the runtime environment")
    return secret


def create_token(user_id: str) -> str:
    """Create a new JWT token for a user."""
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow(),
    }

    return jwt.encode(payload, _get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, _get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        return payload
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail="Authentication service is not configured") from exc
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


async def verify_token(authorization: Optional[str] = Header(None)) -> Dict:
    """Verify JWT token from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    try:
        scheme, token = authorization.split()
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid authorization header") from exc

    if scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authentication scheme")

    payload = decode_token(token)
    return payload


def get_current_user(payload: Dict = Depends(verify_token)) -> str:
    """Extract user ID from token payload."""
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return user_id
