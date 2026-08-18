"""Commerce Studio API for product-to-campaign planning and Pollo dispatch."""
from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import os
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field, HttpUrl

from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient
from backend.ai_films.openmontage_router import OpenMontageDispatchRequest, dispatch_openmontage

router = APIRouter(prefix="/ai-films/commerce", tags=["ai-films-commerce"])
AdFormat = Literal["ugc", "money_shot", "virtual_try_on", "tvc", "problem_solution", "before_after", "unboxing", "tutorial", "feature_highlight"]
Platform = Literal["tiktok", "instagram_reels", "meta_feed", "youtube_shorts", "youtube", "connected_tv"]
FORMAT_BLUEPRINTS: dict[str, dict[str, object]] = {
    "ugc": {"label": "UGC Creator Ad", "beats": ["hook", "problem", "product demo", "proof", "call to action"]},
    "money_shot": {"label": "Product Money Shot", "beats": ["reveal", "detail macro", "hero motion", "benefit", "brand lockup"]},
    "virtual_try_on": {"label": "Virtual Try-On", "beats": ["before", "try-on transition", "fit details", "lifestyle motion", "call to action"]},
    "tvc": {"label": "Brand Commercial", "beats": ["world setup", "desire", "product reveal", "transformation", "brand promise"]},
    "problem_solution": {"label": "Problem / Solution", "beats": ["pain point", "failed alternative", "product answer", "demonstration", "offer"]},
    "before_after": {"label": "Before / After", "beats": ["baseline", "application", "transition", "result", "proof"]},
    "unboxing": {"label": "Unboxing", "beats": ["package reveal", "open", "first reaction", "feature tour", "recommendation"]},
    "tutorial": {"label": "Tutorial", "beats": ["outcome preview", "step one", "step two", "result", "next action"]},
    "feature_highlight": {"label": "Feature Highlights", "beats": ["hook", "feature one", "feature two", "feature three", "call to action"]},
}
PLATFORM_SPECS: dict[str, dict[str, object]] = {
    "tiktok": {"aspect_ratio": "9:16", "default_seconds": 15}, "instagram_reels": {"aspect_ratio": "9:16", "default_seconds": 15},
    "meta_feed": {"aspect_ratio": "4:5", "default_seconds": 15}, "youtube_shorts": {"aspect_ratio": "9:16", "default_seconds": 20},
    "youtube": {"aspect_ratio": "16:9", "default_seconds": 30}, "connected_tv": {"aspect_ratio": "16:9", "default_seconds": 30},
}


class BrandKit(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    voice: str = Field(default="confident, clear, human", max_length=500)
    colors: list[str] = Field(default_factory=list, max_length=8)
    required_phrases: list[str] = Field(default_factory=list, max_length=12)
    prohibited_phrases: list[str] = Field(default_factory=list, max_length=20)
    logo_url: HttpUrl | None = None


class ProductBrief(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    description: str = Field(..., min_length=10, max_length=4000)
    audience: str = Field(..., min_length=2, max_length=500)
    selling_points: list[str] = Field(..., min_length=1, max_length=10)
    product_image_url: HttpUrl | None = None
    offer: str | None = Field(default=None, max_length=500)


class CampaignPlanRequest(BaseModel):
    product: ProductBrief
    brand: BrandKit
    formats: list[AdFormat] = Field(default_factory=lambda: ["ugc", "money_shot"], min_length=1, max_length=9)
    platforms: list[Platform] = Field(default_factory=lambda: ["tiktok", "instagram_reels"], min_length=1, max_length=6)
    variants_per_platform: int = Field(default=2, ge=1, le=5)
    index_with_jockey: bool = True


class CampaignRenderVariant(BaseModel):
    id: str = Field(..., min_length=1, max_length=160)
    platform: Platform
    format: AdFormat
    prompt: str = Field(..., min_length=10, max_length=5000)
    duration_seconds: int = Field(default=8, ge=4, le=30)


class CampaignRenderRequest(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=160)
    brand_name: str = Field(..., min_length=1, max_length=120)
    variants: list[CampaignRenderVariant] = Field(..., min_length=1, max_length=12)


class PolloDispatchRequest(BaseModel):
    prompt: str = Field(..., min_length=10, max_length=5000)
    image: HttpUrl | None = None
    length: Literal[4, 5, 6, 7, 8, 9, 10] = 4
    resolution: Literal["720p", "1080p"] = "720p"
    mode: Literal["basic", "pro"] = "basic"
    generate_audio: bool = False
    webhook_url: HttpUrl | None = None


_rate_windows: dict[str, deque[float]] = defaultdict(deque)


async def _require_user(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Supabase bearer token required")
    token = authorization.split(" ", 1)[1].strip()
    try:
        user = await SupabaseRLSClient(token).current_user()
    except OrchestrationError as exc:
        raise HTTPException(status_code=401, detail="Valid Supabase bearer token required") from exc
    return user.id


def _require_pollo_entitlement(user_id: str) -> None:
    configured = {v.strip() for v in os.getenv("POLLO_ENTITLED_USER_IDS", "").split(",") if v.strip()}
    if not configured:
        raise HTTPException(status_code=503, detail="Pollo dispatch entitlement is not configured")
    if user_id not in configured:
        raise HTTPException(status_code=403, detail="Pollo generation is not enabled for this account")


def _check_pollo_rate_limit(user_id: str) -> None:
    limit = max(1, int(os.getenv("POLLO_DISPATCH_RATE_LIMIT_PER_MINUTE", "5")))
    now = time.monotonic()
    window = _rate_windows[user_id]
    while window and now - window[0] >= 60:
        window.popleft()
    if len(window) >= limit:
        raise HTTPException(status_code=429, detail="Pollo dispatch rate limit exceeded")
    window.append(now)


def _signature_candidates(header: str) -> list[str]:
    candidates: list[str] = []
    for value in header.split():
        parts = value.split(",", 1)
        if len(parts) == 2 and parts[0].strip() == "v1":
            candidates.append(parts[1].strip())
        elif value.strip():
            candidates.append(value.strip())
    return candidates


def _normalize_pollo_status(provider_status: object) -> str:
    """Map provider-specific states into the commerce job status constraint."""
    raw = str(provider_status or "processing").strip().lower()
    if raw in {"success", "succeeded", "succeed"}:
        return "succeeded"
    if raw in {"complete", "completed"}:
        return "completed"
    if raw in {"failed", "failure", "error"}:
        return "failed"
    if raw in {"cancel", "canceled", "cancelled"}:
        return "cancelled"
    if raw in {"reserved"}:
        return "reserved"
    if raw in {"submitted"}:
        return "submitted"
    return "processing"


async def _user_update(access_token: str, table: str, payload: dict[str, Any], row_id: str) -> None:
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "").strip()
    if not base_url or not anon_key:
        raise HTTPException(status_code=503, detail="Commerce persistence is not configured")
    headers = {"apikey": anon_key, "Authorization": f"Bearer {access_token}", "Content-Type": "application/json", "Prefer": "return=minimal"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.patch(f"{base_url}/rest/v1/{table}", headers=headers, json=payload, params={"id": f"eq.{row_id}"})
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Commerce persistence service unavailable") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Commerce reservation update failed")


async def _service_request(method: str, path: str, *, json_body: dict[str, Any] | None = None, params: dict[str, str] | None = None) -> Any:
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base_url or not service_key:
        raise HTTPException(status_code=503, detail="Commerce callback persistence is not configured")
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}", "Content-Type": "application/json", "Prefer": "return=representation"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.request(method, f"{base_url}/rest/v1/{path}", headers=headers, json=json_body, params=params)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Commerce persistence service unavailable") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Commerce persistence failed ({response.status_code})")
    return response.json() if response.content else None


def build_campaign_plan(request: CampaignPlanRequest) -> dict[str, object]:
    variants: list[dict[str, object]] = []
    for platform in request.platforms:
        spec = PLATFORM_SPECS[platform]
        for ad_format in request.formats:
            blueprint = FORMAT_BLUEPRINTS[ad_format]
            for variant_number in range(1, request.variants_per_platform + 1):
                selling_point = request.product.selling_points[(variant_number - 1) % len(request.product.selling_points)]
                required = "; ".join(request.brand.required_phrases) or "none"
                prohibited = "; ".join(request.brand.prohibited_phrases) or "none"
                colors = ", ".join(request.brand.colors) or "use brand-appropriate styling"
                prompt = (
                    f"Create a {blueprint['label']} for {request.product.name}. Product description: {request.product.description} "
                    f"Audience: {request.product.audience}. Lead with: {selling_point}. Brand: {request.brand.name}. Voice: {request.brand.voice}. "
                    f"Brand colors/style: {colors}. Required phrases: {required}. Prohibited phrases: {prohibited}. Visual beats: {', '.join(blueprint['beats'])}. "
                    f"Format {spec['aspect_ratio']}, approximately {spec['default_seconds']} seconds. End with: {request.product.offer or 'a clear product-focused call to action'}.")
                variants.append({
                    "id": f"{platform}-{ad_format}-v{variant_number}",
                    "platform": platform,
                    "format": ad_format,
                    "variant": variant_number,
                    "aspect_ratio": spec["aspect_ratio"],
                    "duration_seconds": spec["default_seconds"],
                    "selling_point": selling_point,
                    "beats": blueprint["beats"],
                    "prompt": prompt,
                    "provider_route": {"provider": "pollo", "model": "pollo-v2-5", "fallback": "openai"},
                    "jockey_index_after_render": request.index_with_jockey,
                })
    return {"product": request.product.name, "brand": request.brand.name, "status": "planned", "variant_count": len(variants), "credit_spend": False, "variants": variants}


@router.post("/campaigns/render", status_code=status.HTTP_202_ACCEPTED)
async def render_commerce_campaign(
    request: CampaignRenderRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Queue approved commerce variants on the deployed OpenAI/Sora worker.

    This is intentionally limited to twelve variants per request: AI video
    renders consume external provider capacity, so a bounded batch preserves a
    clear approval point while still supporting practical campaign production.
    Pollo dispatch remains available on its dedicated route when its server-side
    entitlement and callback configuration are provisioned.
    """
    await _require_user(authorization)
    queued: list[dict[str, object]] = []
    for variant in request.variants:
        dispatch = await dispatch_openmontage(
            OpenMontageDispatchRequest(
                job_id=f"commerce-{variant.id}-{uuid.uuid4().hex[:12]}",
                idea=f"{request.brand_name} commercial for {request.product_name} — {variant.format} on {variant.platform}",
                screenplay=variant.prompt,
                video_prompt=variant.prompt,
                duration_seconds=min(20, variant.duration_seconds),
            ),
            authorization=authorization,
        )
        queued.append(
            {
                "variant_id": variant.id,
                "project_id": dispatch["project_id"],
                "render_job_id": dispatch["render_job_id"],
                "provider": dispatch["provider"],
                "status": dispatch["status"],
            }
        )
    return {"status": "queued", "provider": "openai", "job_count": len(queued), "jobs": queued}


@router.get("/templates")
def list_commerce_templates() -> dict[str, object]:
    return {"formats": FORMAT_BLUEPRINTS, "platforms": PLATFORM_SPECS}


@router.post("/campaigns/plan")
async def plan_campaign(request: CampaignPlanRequest, authorization: str | None = Header(default=None)) -> dict[str, object]:
    await _require_user(authorization)
    return build_campaign_plan(request)


@router.post("/providers/pollo/dispatch", status_code=status.HTTP_202_ACCEPTED)
async def dispatch_pollo(request: PolloDispatchRequest, authorization: str | None = Header(default=None)) -> dict[str, object]:
    token = authorization.split(" ", 1)[1].strip() if authorization and authorization.lower().startswith("bearer ") else ""
    user_id = await _require_user(authorization)
    _require_pollo_entitlement(user_id)
    _check_pollo_rate_limit(user_id)

    api_key = os.getenv("POLLO_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Pollo is not configured; set POLLO_API_KEY server-side")

    internal_webhook_url = os.getenv("POLLO_WEBHOOK_URL", "").strip()
    if not internal_webhook_url:
        raise HTTPException(status_code=503, detail="Pollo internal webhook is not configured; set POLLO_WEBHOOK_URL server-side")

    webhook_secret = os.getenv("POLLO_WEBHOOK_SECRET", "").strip()
    if not webhook_secret:
        raise HTTPException(status_code=503, detail="Pollo webhook verification is not configured; set POLLO_WEBHOOK_SECRET server-side")

    db = SupabaseRLSClient(token)
    reservation = await db.insert(
        "ai_film_commerce_jobs",
        {
            "owner_id": user_id,
            "status": "reserved",
            "provider": "pollo",
            "model": "pollo-v2-5",
            "request": request.model_dump(mode="json"),
            "handoff_status": "pending",
        },
    )
    job_id = reservation["id"]
    payload: dict[str, object] = {
        "input": {
            "prompt": request.prompt,
            "length": request.length,
            "resolution": request.resolution,
            "mode": request.mode,
            "generateAudio": request.generate_audio,
        },
        "clientSource": "d3vonn-ai-films-commerce",
        "webhookUrl": internal_webhook_url,
    }
    if request.image:
        payload["input"]["image"] = str(request.image)  # type: ignore[index]

    url = os.getenv("POLLO_API_BASE_URL", "https://pollo.ai/api/platform").rstrip("/") + "/generation/pollo/pollo-v2-5"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload, headers={"x-api-key": api_key})
            response.raise_for_status()
        result = response.json()
        task_id = str(result.get("taskId") or "").strip()
        if not task_id:
            raise ValueError("Pollo did not return a taskId")
        await _user_update(token, "ai_film_commerce_jobs", {"task_id": task_id, "status": "submitted", "provider_response": result}, job_id)
    except (httpx.HTTPError, ValueError) as exc:
        await _user_update(token, "ai_film_commerce_jobs", {"status": "failed", "error_message": str(exc)}, job_id)
        raise HTTPException(status_code=502, detail=f"Pollo dispatch failed: {exc}") from exc

    return {"provider": "pollo", "model": "pollo-v2-5", "task_id": task_id, "status": result.get("status", "waiting"), "job_id": job_id}


@router.post("/providers/pollo/webhook")
async def pollo_webhook(request: Request) -> dict[str, str]:
    secret = os.getenv("POLLO_WEBHOOK_SECRET", "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="Pollo webhook verification is not configured")

    webhook_id = request.headers.get("X-Webhook-Id", "")
    timestamp = request.headers.get("X-Webhook-Timestamp", "")
    signature = request.headers.get("X-Webhook-Signature", "")
    body = await request.body()
    try:
        key = base64.b64decode(secret, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=500, detail="Invalid webhook secret encoding") from exc

    signed = webhook_id.encode() + b"." + timestamp.encode() + b"." + body
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
    if not signature or not any(hmac.compare_digest(candidate, expected) for candidate in _signature_candidates(signature)):
        raise HTTPException(status_code=401, detail="Invalid Pollo webhook signature")

    try:
        event = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid Pollo webhook JSON") from exc

    task_id = str(event.get("taskId") or event.get("task_id") or "").strip()
    if not task_id:
        raise HTTPException(status_code=400, detail="Pollo webhook task id is required")

    rows = await _service_request("GET", "ai_film_commerce_jobs", params={"task_id": f"eq.{task_id}", "select": "*"})
    if not rows:
        raise HTTPException(status_code=404, detail="Unknown Pollo task")

    provider_status = str(event.get("status") or "processing").strip().lower()
    status_value = _normalize_pollo_status(provider_status)
    completed = status_value in {"succeeded", "completed", "failed", "cancelled"}
    handoff_status = "queued" if status_value in {"succeeded", "completed"} else "not_applicable"
    output = event.get("output") or (event.get("data") if isinstance(event.get("data"), dict) else {}) or event.get("result") or {}

    await _service_request(
        "PATCH",
        "ai_film_commerce_jobs",
        json_body={
            "status": status_value,
            "output": output if isinstance(output, dict) else {"value": output},
            "provider_event": event,
            "completed_at": datetime.now(timezone.utc).isoformat() if completed else None,
            "handoff_status": handoff_status,
            "handoff_payload": {"task_id": task_id, "output": output, "targets": ["jockey", "twelvelabs"]} if handoff_status == "queued" else {},
        },
        params={"task_id": f"eq.{task_id}"},
    )
    return {"task_id": task_id, "status": status_value, "accepted": "true", "handoff": handoff_status}
