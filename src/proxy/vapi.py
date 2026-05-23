from collections import deque
from datetime import datetime
from typing import Any, Deque, Dict, List, Optional
import os

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from auth.token_utils import verify_token
from secret_manager.manager import get_api_key

router = APIRouter()

VAPI_BASE_URL = os.getenv("VAPI_BASE_URL", "https://api.vapi.ai")
RECENT_EVENTS_LIMIT = int(os.getenv("VAPI_RECENT_EVENTS_LIMIT", "100"))
_recent_events: Deque[Dict[str, Any]] = deque(maxlen=RECENT_EVENTS_LIMIT)


class VapiCallRequest(BaseModel):
    assistant_id: Optional[str] = Field(default=None, alias="assistantId")
    phone_number_id: Optional[str] = Field(default=None, alias="phoneNumberId")
    customer: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None
    extra: Optional[Dict[str, Any]] = None

    class Config:
        allow_population_by_field_name = True


class VapiCallResult(BaseModel):
    success: bool
    call: Dict[str, Any]


def _get_vapi_key() -> str:
    vapi_key = get_api_key("VAPI_API_KEY")
    if not vapi_key:
        raise HTTPException(status_code=403, detail="Vapi API key not configured")
    return vapi_key


def _verify_optional_webhook_bearer(authorization: Optional[str]) -> None:
    expected = os.getenv("VAPI_WEBHOOK_BEARER_TOKEN")
    if not expected:
        return

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Vapi webhook bearer token")

    provided = authorization.removeprefix("Bearer ").strip()
    if provided != expected:
        raise HTTPException(status_code=403, detail="Invalid Vapi webhook bearer token")


@router.post("/proxy/vapi/call", response_model=VapiCallResult)
async def proxy_vapi_call(data: VapiCallRequest, token: Dict = Depends(verify_token)):
    """Create an outbound Vapi call without exposing VAPI_API_KEY to the browser."""
    vapi_key = _get_vapi_key()

    payload = data.dict(by_alias=True, exclude_none=True, exclude={"extra"})
    if data.extra:
        payload.update(data.extra)

    if not payload.get("phoneNumberId"):
        phone_number_id = os.getenv("VAPI_PHONE_NUMBER_ID")
        if phone_number_id:
            payload["phoneNumberId"] = phone_number_id

    if not payload.get("phoneNumberId"):
        raise HTTPException(
            status_code=400,
            detail="phoneNumberId is required or VAPI_PHONE_NUMBER_ID must be configured",
        )

    headers = {
        "Authorization": f"Bearer {vapi_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{VAPI_BASE_URL}/call",
                headers=headers,
                json=payload,
                timeout=30.0,
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Error communicating with Vapi: {str(exc)}",
            ) from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Vapi API error: {response.text}",
        )

    return VapiCallResult(success=True, call=response.json())


@router.post("/proxy/vapi/webhook")
async def proxy_vapi_webhook(
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    """Receive Vapi server events and keep a short in-memory event buffer."""
    _verify_optional_webhook_bearer(authorization)

    try:
        event = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Webhook body must be valid JSON") from exc

    stored_event = {
        "received_at": datetime.utcnow().isoformat() + "Z",
        "event": event,
    }
    _recent_events.appendleft(stored_event)

    return {"status": "received"}


@router.get("/proxy/vapi/events")
async def proxy_vapi_events(token: Dict = Depends(verify_token)):
    """Return recent Vapi webhook events kept in memory for quick inspection."""
    return {
        "events": list(_recent_events),
        "count": len(_recent_events),
        "limit": RECENT_EVENTS_LIMIT,
    }
