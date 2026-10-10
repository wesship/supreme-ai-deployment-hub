"""Authenticated TwelveLabs search + analyze surface for D3VONN.IO AI Films."""
from typing import Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

from backend.ai_films.router import _require_authenticated_user
from backend.ai_films.twelvelabs import TwelveLabsError
from backend.ai_films.twelvelabs_analyze import TwelveLabsAnalyzeClient
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


class AnalyzeAssetRequest(BaseModel):
    asset_id: str = Field(..., min_length=1, max_length=200)
    prompt: str = Field(..., min_length=1, max_length=12000)
    model_name: Literal["pegasus1.2", "pegasus1.5"] = "pegasus1.5"
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    max_tokens: int = Field(default=4096, ge=2, le=98304)
    start_time: float | None = Field(default=None, ge=0.0)
    end_time: float | None = Field(default=None, gt=0.0)

    @model_validator(mode="after")
    def validate_window_and_model(self):
        if (self.start_time is not None or self.end_time is not None) and self.model_name != "pegasus1.5":
            raise ValueError("start_time/end_time require pegasus1.5")
        if self.start_time is not None and self.end_time is not None:
            if self.end_time <= self.start_time:
                raise ValueError("end_time must be greater than start_time")
            if self.end_time - self.start_time < 4:
                raise ValueError("Analyze clip windows must be at least 4 seconds")
        if self.model_name == "pegasus1.5" and self.max_tokens < 512:
            raise ValueError("pegasus1.5 requires max_tokens >= 512")
        if self.model_name == "pegasus1.2" and self.max_tokens > 4096:
            raise ValueError("pegasus1.2 supports max_tokens <= 4096")
        return self


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


@router.post("/analyze")
async def analyze_asset(
    request: AnalyzeAssetRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Analyze a previously uploaded/indexed TwelveLabs asset with Pegasus."""
    await _require_authenticated_user(authorization)
    client = TwelveLabsAnalyzeClient()
    try:
        result = await client.analyze_asset(
            request.asset_id,
            request.prompt,
            model_name=request.model_name,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            start_time=request.start_time,
            end_time=request.end_time,
        )
    except TwelveLabsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {
        "provider": "twelvelabs",
        "surface": "analyze",
        "asset_id": request.asset_id,
        "model": request.model_name,
        "result": result,
    }
