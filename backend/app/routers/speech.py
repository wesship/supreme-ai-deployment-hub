"""
Devonn.ai Backend Proxy — /api/speech

Secure proxy routes for the Speech Intelligence microservice. The frontend sends
media files to this backend, and this backend forwards them to the separately
scalable Whisper service. Service URLs and API keys remain server-side only.
"""
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from backend.app.config import get_settings
from backend.app.middleware.auth import get_current_user_id
from backend.app.middleware.rate_limit import rate_limit
from backend.app.models.speech import SpeechHealthResponse, SpeechTranscriptionResponse

logger = logging.getLogger(__name__)
router = APIRouter()

_ALLOWED_MEDIA_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/m4a",
    "audio/webm",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "application/octet-stream",
}


@router.get(
    "/speech/health",
    response_model=SpeechHealthResponse,
    summary="Speech Intelligence health",
    description="Check whether the Speech Intelligence service is configured behind the Devonn backend.",
)
async def speech_health(
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(30)),
) -> SpeechHealthResponse:
    settings = get_settings()
    base_url = settings.speech_intelligence_base_url.rstrip("/")
    if not base_url:
        return SpeechHealthResponse(configured=False, service_url="", status="missing SPEECH_INTELLIGENCE_BASE_URL")

    headers = _speech_headers(settings.speech_intelligence_api_key)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{base_url}/health", headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("speech_health user=%s error=%s", user_id, exc)
        return SpeechHealthResponse(configured=True, service_url=base_url, status=f"unreachable: {exc}")

    if resp.status_code >= 400:
        return SpeechHealthResponse(configured=True, service_url=base_url, status=f"error {resp.status_code}")
    return SpeechHealthResponse(configured=True, service_url=base_url, status="ok")


@router.post(
    "/speech/transcribe",
    response_model=SpeechTranscriptionResponse,
    summary="Transcribe audio/video",
    description="Upload audio or video and receive transcript chunks, summary, topics, action items, and concept graph output.",
)
async def transcribe_media(
    file: UploadFile = File(...),
    model: str = Form(default="openai/whisper-large-v3"),
    language: Optional[str] = Form(default=None),
    task: str = Form(default="transcribe"),
    include_graph: bool = Form(default=True),
    save_to_crm: bool = Form(default=False),
    crm_contact_id: Optional[str] = Form(default=None),
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(10)),
) -> SpeechTranscriptionResponse:
    settings = get_settings()
    base_url = settings.speech_intelligence_base_url.rstrip("/")
    if not base_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speech Intelligence service not configured (set SPEECH_INTELLIGENCE_BASE_URL on server)",
        )

    if file.content_type and file.content_type not in _ALLOWED_MEDIA_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported media type '{file.content_type}'. Upload WAV, MP3, M4A, WebM, MOV, or MP4.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file was empty")
    if len(content) > settings.speech_intelligence_max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.speech_intelligence_max_upload_mb} MB upload limit",
        )

    data = {
        "model": model,
        "task": task,
        "include_graph": str(include_graph).lower(),
        "save_to_crm": str(save_to_crm).lower(),
        "user_id": user_id,
    }
    if language:
        data["language"] = language
    if crm_contact_id:
        data["crm_contact_id"] = crm_contact_id

    headers = _speech_headers(settings.speech_intelligence_api_key)
    files = {
        "file": (
            file.filename or "upload",
            content,
            file.content_type or "application/octet-stream",
        )
    }

    try:
        async with httpx.AsyncClient(timeout=settings.speech_intelligence_timeout_seconds) as client:
            resp = await client.post(
                f"{base_url}/api/speech/transcribe",
                data=data,
                files=files,
                headers=headers,
            )
    except httpx.TimeoutException as exc:
        logger.exception("speech_transcribe timeout user=%s filename=%s", user_id, file.filename)
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=f"Speech service timed out: {exc}") from exc
    except httpx.HTTPError as exc:
        logger.exception("speech_transcribe upstream error user=%s filename=%s", user_id, file.filename)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Speech service unreachable: {exc}") from exc

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Speech service error {resp.status_code}: {resp.text[:500]}",
        )

    payload = resp.json()
    logger.info(
        "speech_transcribe user=%s filename=%s model=%s bytes=%d",
        user_id,
        file.filename,
        model,
        len(content),
    )
    return SpeechTranscriptionResponse(
        filename=payload.get("filename") or file.filename or "upload",
        model=payload.get("model") or model,
        status=payload.get("status", "completed"),
        job_id=payload.get("job_id"),
        transcript=payload.get("transcript", ""),
        chunks=payload.get("chunks", []),
        summary=payload.get("summary"),
        topics=payload.get("topics", []),
        action_items=payload.get("action_items", []),
        knowledge_graph=payload.get("knowledge_graph"),
        raw=payload,
    )


def _speech_headers(api_key: str) -> dict[str, str]:
    headers: dict[str, str] = {"Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers
