"""Commerce Studio API for product-to-campaign planning and Pollo dispatch."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from typing import Literal

import httpx
from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field, HttpUrl

from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient

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
    "tiktok": {"aspect_ratio": "9:16", "default_seconds": 15},
    "instagram_reels": {"aspect_ratio": "9:16", "default_seconds": 15},
    "meta_feed": {"aspect_ratio": "4:5", "default_seconds": 15},
    "youtube_shorts": {"aspect_ratio": "9:16", "default_seconds": 20},
    "youtube": {"aspect_ratio": "16:9", "default_seconds": 30},
    "connected_tv": {"aspect_ratio": "16:9", "default_seconds": 30},
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
    formats: list[AdFormat] = Field(default_factory=lambda: ["ugc", "money_shot"], min_length=1, max_length=5)
    platforms: list[Platform] = Field(default_factory=lambda: ["tiktok", "instagram_reels"], min_length=1, max_length=6)
    variants_per_platform: int = Field(default=2, ge=1, le=5)
    index_with_jockey: bool = True


class PolloDispatchRequest(BaseModel):
    prompt: str = Field(..., min_length=10, max_length=5000)
    image: HttpUrl | None = None
    length: Literal[4, 5, 6, 7, 8, 9, 10] = 4
    resolution: Literal["720p", "1080p"] = "720p"
    mode: Literal["basic", "pro"] = "basic"
    generate_audio: bool = False
    webhook_url: HttpUrl | None = None


async def _require_user(authorization: str | None) -> None:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Supabase bearer token required")
    token = authorization.split(" ", 1)[1].strip()
    try:
        await SupabaseRLSClient(token).current_user()
    except OrchestrationError as exc:
        raise HTTPException(status_code=401, detail="Valid Supabase bearer token required") from exc


def build_campaign_plan(request: CampaignPlanRequest) -> dict[str, object]:
    variants: list[dict[str, object]] = []
    for platform in request.platforms:
        spec = PLATFORM_SPECS[platform]
        for ad_format in request.formats:
            blueprint = FORMAT_BLUEPRINTS[ad_format]
            for variant_number in range(1, request.variants_per_platform + 1):
                selling_point = request.product.selling_points[(variant_number - 1) % len(request.product.selling_points)]
                prompt = (
                    f"Create a {blueprint['label']} for {request.product.name}. "
                    f"Audience: {request.product.audience}. Lead with: {selling_point}. "
                    f"Brand voice: {request.brand.voice}. Visual beats: {', '.join(blueprint['beats'])}. "
                    f"Format {spec['aspect_ratio']}, approximately {spec['default_seconds']} seconds. "
                    f"End with: {request.product.offer or 'a clear product-focused call to action'}."
                )
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
    return {
        "product": request.product.name,
        "brand": request.brand.name,
        "status": "planned",
        "variant_count": len(variants),
        "credit_spend": False,
        "variants": variants,
    }


@router.get("/templates")
def list_commerce_templates() -> dict[str, object]:
    return {"formats": FORMAT_BLUEPRINTS, "platforms": PLATFORM_SPECS}


@router.post("/campaigns/plan")
async def plan_campaign(request: CampaignPlanRequest, authorization: str | None = Header(default=None)) -> dict[str, object]:
    await _require_user(authorization)
    return build_campaign_plan(request)


@router.post("/providers/pollo/dispatch", status_code=status.HTTP_202_ACCEPTED)
async def dispatch_pollo(request: PolloDispatchRequest, authorization: str | None = Header(default=None)) -> dict[str, object]:
    await _require_user(authorization)
    api_key = os.getenv("POLLO_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Pollo is not configured; set POLLO_API_KEY server-side")
    payload: dict[str, object] = {
        "input": {
            "prompt": request.prompt,
            "length": request.length,
            "resolution": request.resolution,
            "mode": request.mode,
            "generateAudio": request.generate_audio,
        },
        "clientSource": "d3vonn-ai-films-commerce",
    }
    if request.image:
        payload["input"]["image"] = str(request.image)  # type: ignore[index]
    webhook_url = request.webhook_url or os.getenv("POLLO_WEBHOOK_URL")
    if webhook_url:
        payload["webhookUrl"] = str(webhook_url)
    url = os.getenv("POLLO_API_BASE_URL", "https://pollo.ai/api/platform").rstrip("/") + "/generation/pollo/pollo-v2-5"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload, headers={"x-api-key": api_key})
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Pollo dispatch failed: {exc}") from exc
    result = response.json()
    return {"provider": "pollo", "model": "pollo-v2-5", "task_id": result.get("taskId"), "status": result.get("status", "waiting")}


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
        key = base64.b64decode(secret)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Invalid webhook secret encoding") from exc
    signed = webhook_id.encode() + b"." + timestamp.encode() + b"." + body
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
    if not signature or not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid Pollo webhook signature")
    event = json.loads(body)
    return {"task_id": str(event.get("taskId", "")), "status": str(event.get("status", "unknown")), "accepted": "true"}
