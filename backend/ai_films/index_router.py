"""Authenticated TwelveLabs index-search surface for D3VONN.IO AI Films."""
from typing import Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from backend.ai_films.router import _require_authenticated_user
from backend.ai_films.twelvelabs import TwelveLabsError
from backend.ai_films.twelvelabs_index import TwelveLabsIndexClient

router = APIRouter(
    prefix="/ai-films/intelligence/twelvelabs/index",
    tags=["ai-films", "twelvelabs-index"],
)


class IndexSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    page_limit: int = Field(default=10, ge=1, le=50)
    search_options: list[Literal["visual", "audio", "transcription"]] = Field(
        default_factory=lambda: ["visual", "audio", "transcription"],
        min_length=1,
        max_length=3,
    )
    transcription_options: list[Literal["lexical", "semantic"]] = Field(
        default_factory=lambda: ["lexical", "semantic"],
        min_length=1,
        max_length=2,
    )
    group_by: Literal["clip", "video"] = "clip"
    operator: Literal["or", "and"] = "or"
    include_user_metadata: bool = True


@router.get("/status")
async def get_index_status(
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    await _require_authenticated_user(authorization)
    client = TwelveLabsIndexClient()
    try:
        index = await client.retrieve_index()
    except TwelveLabsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {
        "provider": "twelvelabs",
        "surface": "index",
        "status": "ready",
        "index": {
            "id": index.get("_id") or index.get("id") or client.index_id,
            "name": index.get("index_name"),
            "video_count": index.get("video_count"),
            "total_duration": index.get("total_duration"),
            "updated_at": index.get("updated_at"),
            "expires_at": index.get("expires_at"),
        },
    }


@router.post("/search")
async def search_index(
    request: IndexSearchRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    await _require_authenticated_user(authorization)
    client = TwelveLabsIndexClient()
    try:
        return await client.search(
            request.query,
            page_limit=request.page_limit,
            search_options=tuple(request.search_options),
            transcription_options=tuple(request.transcription_options),
            group_by=request.group_by,
            operator=request.operator,
            include_user_metadata=request.include_user_metadata,
        )
    except TwelveLabsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
