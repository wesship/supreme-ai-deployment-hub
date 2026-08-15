"""
D3VONN.IO backend proxy routes for voice, GitHub CI/CD, and n8n.
All provider credentials remain server-side.
"""
import logging
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from backend.app.config import get_settings
from backend.app.middleware.auth import get_current_user_id
from backend.app.middleware.rate_limit import rate_limit
from backend.app.models.proxy import (
    GitHubRunsStatusResponse,
    GitHubWorkflowTriggerRequest,
    GitHubWorkflowTriggerResponse,
    N8NExecuteRequest,
    N8NExecuteResponse,
    STTTokenRequest,
    STTTokenResponse,
    TTSRequest,
    WorkflowRun,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/tools/voice/tts",
    summary="Text-to-Speech",
    description="Convert text to speech with ElevenLabs or OpenAI fallback.",
    response_class=Response,
)
async def voice_tts(
    request: TTSRequest,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(30)),
) -> Response:
    settings = get_settings()

    if settings.elevenlabs_api_key:
        voice_id = request.voice_id or settings.elevenlabs_default_voice_id
        model = request.model or settings.elevenlabs_default_model
        payload = {
            "text": request.text,
            "model_id": model,
            "voice_settings": request.voice_settings.model_dump(),
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{quote(voice_id, safe='')}",
                json=payload,
                headers={
                    "xi-api-key": settings.elevenlabs_api_key,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
            )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"ElevenLabs TTS error {resp.status_code}: {resp.text[:300]}",
            )
        logger.info("voice_tts provider=elevenlabs chars=%d", len(request.text))
        return Response(content=resp.content, media_type="audio/mpeg")

    if settings.openai_api_key:
        openai_voice_map = {
            "21m00Tcm4TlvDq8ikWAM": "alloy",
            "9BWtsMINqrJLrRacOk9x": "nova",
            "CwhRBWXzGAHq8TQ4Fs17": "echo",
            "EXAVITQu4vr4xnSDxMaL": "shimmer",
        }
        openai_voice = openai_voice_map.get(
            request.voice_id or settings.elevenlabs_default_voice_id,
            "alloy",
        )
        payload = {
            "model": "tts-1",
            "input": request.text,
            "voice": openai_voice,
            "response_format": "mp3",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/speech",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"OpenAI TTS error {resp.status_code}: {resp.text[:300]}",
            )
        logger.info(
            "voice_tts provider=openai chars=%d voice=%s",
            len(request.text),
            openai_voice,
        )
        return Response(content=resp.content, media_type="audio/mpeg")

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="TTS service not configured (set ELEVENLABS_API_KEY or OPENAI_API_KEY on server)",
    )


@router.post(
    "/tools/voice/stt-token",
    response_model=STTTokenResponse,
    summary="AssemblyAI STT Temporary Token",
    description="Issue a short-lived AssemblyAI v3 streaming token for browser transcription.",
)
async def voice_stt_token(
    request: STTTokenRequest,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(20)),
) -> STTTokenResponse:
    settings = get_settings()
    if not settings.assemblyai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="STT service not configured (ASSEMBLYAI_API_KEY missing on server)",
        )

    expires_in_seconds = max(1, min(request.expires_in, 600))
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            "https://streaming.assemblyai.com/v3/token",
            params={
                "expires_in_seconds": expires_in_seconds,
                "max_session_duration_seconds": 3600,
            },
            headers={"Authorization": settings.assemblyai_api_key},
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AssemblyAI token error {resp.status_code}: {resp.text[:300]}",
        )

    token = resp.json().get("token", "")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AssemblyAI returned no temporary streaming token",
        )
    logger.info("voice_stt_token provider=assemblyai_v3 expires_in=%d", expires_in_seconds)
    return STTTokenResponse(token=token)


@router.post(
    "/tools/github/workflows/trigger",
    response_model=GitHubWorkflowTriggerResponse,
    summary="GitHub Workflow Trigger",
)
async def github_trigger_workflow(
    request: GitHubWorkflowTriggerRequest,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(10)),
) -> GitHubWorkflowTriggerResponse:
    settings = get_settings()
    if not settings.github_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub CI/CD not configured (GITHUB_TOKEN missing on server)",
        )

    repo_path = "/".join(quote(part, safe="") for part in settings.github_repo.split("/", 1))
    workflow_path = quote(request.workflow, safe="")
    url = f"https://api.github.com/repos/{repo_path}/actions/workflows/{workflow_path}/dispatches"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            url,
            json={"ref": request.branch, "inputs": request.inputs},
            headers={
                "Authorization": f"Bearer {settings.github_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
    if resp.status_code not in (200, 204):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GitHub API error {resp.status_code}: {resp.text[:300]}",
        )

    ts = datetime.now(timezone.utc).isoformat()
    logger.info("github_trigger dispatched")
    return GitHubWorkflowTriggerResponse(
        success=True,
        message=f"Workflow '{request.workflow}' triggered on branch '{request.branch}'",
        timestamp=ts,
    )


@router.get(
    "/tools/github/runs/status",
    response_model=GitHubRunsStatusResponse,
    summary="GitHub Workflow Run Status",
)
async def github_runs_status(
    workflow: str | None = None,
    limit: int = 5,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(30)),
) -> GitHubRunsStatusResponse:
    settings = get_settings()
    if not settings.github_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub CI/CD not configured (GITHUB_TOKEN missing on server)",
        )

    repo_path = "/".join(quote(part, safe="") for part in settings.github_repo.split("/", 1))
    url = (
        f"https://api.github.com/repos/{repo_path}/actions/workflows/{quote(workflow, safe='')}/runs"
        if workflow
        else f"https://api.github.com/repos/{repo_path}/actions/runs"
    )
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            url,
            params={"per_page": min(limit, 50)},
            headers={
                "Authorization": f"Bearer {settings.github_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GitHub API error {resp.status_code}: {resp.text[:300]}",
        )

    data = resp.json()
    runs_raw = data.get("workflow_runs", [])
    runs = [
        WorkflowRun(
            name=item.get("name", ""),
            status=item.get("status", ""),
            conclusion=item.get("conclusion"),
            created_at=item.get("created_at", ""),
            url=item.get("html_url", ""),
        )
        for item in runs_raw[:limit]
    ]
    return GitHubRunsStatusResponse(runs=runs, total=data.get("total_count", len(runs)))


@router.post(
    "/tools/n8n/execute",
    response_model=N8NExecuteResponse,
    summary="n8n Workflow Execution",
)
async def n8n_execute(
    request: N8NExecuteRequest,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(20)),
) -> N8NExecuteResponse:
    settings = get_settings()
    if not settings.n8n_api_key or not settings.n8n_base_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="n8n not configured (N8N_API_KEY or N8N_BASE_URL missing on server)",
        )

    ts = datetime.now(timezone.utc).isoformat()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            list_resp = await client.get(
                f"{settings.n8n_base_url}/api/v1/workflows",
                headers={"X-N8N-API-KEY": settings.n8n_api_key},
                params={"name": request.workflow_name},
            )
        if list_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"n8n API error {list_resp.status_code}: {list_resp.text[:300]}",
            )

        workflows = list_resp.json().get("data", [])
        matched = [item for item in workflows if item.get("name") == request.workflow_name]
        if not matched:
            return N8NExecuteResponse(
                success=False,
                workflow=request.workflow_name,
                timestamp=ts,
                error=f"Workflow '{request.workflow_name}' not found in n8n",
            )

        workflow_id = matched[0]["id"]
        async with httpx.AsyncClient(timeout=30.0) as client:
            exec_resp = await client.post(
                f"{settings.n8n_base_url}/api/v1/workflows/{quote(str(workflow_id), safe='')}/execute",
                json={"data": request.payload},
                headers={
                    "X-N8N-API-KEY": settings.n8n_api_key,
                    "Content-Type": "application/json",
                },
            )
        if exec_resp.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"n8n execution error {exec_resp.status_code}: {exec_resp.text[:300]}",
            )

        result = exec_resp.json()
        logger.info("n8n_execute completed")
        return N8NExecuteResponse(success=True, workflow=request.workflow_name, result=result, timestamp=ts)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("n8n_execute failed")
        return N8NExecuteResponse(
            success=False,
            workflow=request.workflow_name,
            timestamp=ts,
            error=str(exc),
        )
