"""Authenticated Visual Prompt Intelligence API."""
from __future__ import annotations

from threading import RLock
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from backend.app.middleware.auth import get_current_user_id
from backend.visual_intelligence.style_library import DEFAULT_STYLES, VisualStyle, VisualStyleLibrary
from backend.visual_intelligence.upstream_catalog import (
    UpstreamCatalogError,
    fetch_and_normalize,
    source_manifest,
)

router = APIRouter(prefix="/visual", tags=["visual-intelligence"])


class CompileVisualPromptRequest(BaseModel):
    request: str = Field(..., min_length=1, max_length=8000)
    style_id: str | None = Field(default=None, max_length=200)
    constraints: list[str] = Field(default_factory=list, max_length=32)
    negative_constraints: list[str] = Field(default_factory=list, max_length=32)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CatalogRegistry:
    """Small process-local registry; persistence arrives in the Supabase gate."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._upstream_styles: tuple[VisualStyle, ...] = ()
        self._library = VisualStyleLibrary(DEFAULT_STYLES)

    def library(self) -> VisualStyleLibrary:
        with self._lock:
            return self._library

    def replace_upstream(self, styles: tuple[VisualStyle, ...]) -> int:
        with self._lock:
            self._upstream_styles = styles
            self._library = VisualStyleLibrary((*DEFAULT_STYLES, *styles))
            return len(styles)

    def status(self) -> dict[str, int | bool]:
        with self._lock:
            return {
                "loaded": bool(self._upstream_styles),
                "upstream_styles": len(self._upstream_styles),
                "total_styles": len(self._library.list_styles()),
            }


_registry = CatalogRegistry()


def _style_payload(style: VisualStyle) -> dict[str, object]:
    return {
        "style_id": style.style_id,
        "name": style.name,
        "category": style.category,
        "tags": sorted(style.tags),
        "source": style.source,
    }


@router.get("/source")
async def get_visual_source(_user_id: str = Depends(get_current_user_id)) -> dict[str, object]:
    return {"upstream": source_manifest(), "catalog": _registry.status()}


@router.get("/styles")
async def search_visual_styles(
    q: str = Query(default="", max_length=300),
    limit: int = Query(default=10, ge=1, le=50),
    _user_id: str = Depends(get_current_user_id),
) -> dict[str, object]:
    library = _registry.library()
    styles = library.search(q, limit=limit) if q.strip() else library.list_styles()[:limit]
    return {"items": [_style_payload(style) for style in styles], "count": len(styles), "catalog": _registry.status()}


@router.post("/catalog/load")
async def load_upstream_catalog(_user_id: str = Depends(get_current_user_id)) -> dict[str, object]:
    try:
        styles = await run_in_threadpool(fetch_and_normalize)
    except UpstreamCatalogError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Pinned visual catalog could not be loaded",
        ) from exc
    count = _registry.replace_upstream(styles)
    return {"loaded": True, "imported_styles": count, "upstream": source_manifest(), "catalog": _registry.status()}


@router.post("/compile")
async def compile_visual_prompt(
    body: CompileVisualPromptRequest,
    _user_id: str = Depends(get_current_user_id),
) -> dict[str, object]:
    try:
        compiled = _registry.library().compile(
            body.request,
            style_id=body.style_id,
            constraints=body.constraints,
            negative_constraints=body.negative_constraints,
            metadata=body.metadata,
        )
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    return {
        "prompt": compiled.prompt,
        "negative_prompt": compiled.negative_prompt,
        "style_id": compiled.style_id,
        "category": compiled.category,
        "source": compiled.source,
        "metadata": dict(compiled.metadata),
    }
