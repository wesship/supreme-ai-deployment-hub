"""Hermes voice preflight; no voice commands execute here."""
import os
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.auth.supabase_jwt import require_occ_access

router = APIRouter(prefix="/api/hermes/voice", tags=["hermes-voice"])

class VoicePreflightRequest(BaseModel):
    session_id: UUID

@router.post("/preflight")
async def voice_preflight(body: VoicePreflightRequest, principal=Depends(require_occ_access)):
    if os.getenv("HERMES_VOICE_UI_ENABLED", "").lower() not in {"1", "true", "yes", "on"}:
        raise HTTPException(status_code=503, detail="Voice gateway disabled")
    # Persistent verification is not yet connected: always deny.
    raise HTTPException(status_code=403, detail="Voice session not authorized")
