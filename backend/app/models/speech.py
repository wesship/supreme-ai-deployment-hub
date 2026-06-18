"""
Devonn.ai Speech Intelligence models.

These schemas describe the backend proxy response returned by the external
Speech Intelligence microservice. The microservice performs Whisper/Distil-
Whisper transcription and lightweight transcript intelligence; this backend
keeps provider keys and service URLs server-side.
"""
from typing import Any, Optional

from pydantic import BaseModel, Field


class SpeechChunk(BaseModel):
    start: float = Field(..., ge=0)
    end: float = Field(..., ge=0)
    text: str = Field(..., min_length=1)


class SpeechGraphNode(BaseModel):
    id: str
    label: str
    type: str = "concept"
    metadata: dict[str, Any] = Field(default_factory=dict)


class SpeechGraphEdge(BaseModel):
    source: str
    target: str
    relationship: str = "related_to"
    weight: float = Field(default=1.0, ge=0)


class SpeechKnowledgeGraph(BaseModel):
    nodes: list[SpeechGraphNode] = Field(default_factory=list)
    edges: list[SpeechGraphEdge] = Field(default_factory=list)


class SpeechTranscriptionResponse(BaseModel):
    status: str = "completed"
    job_id: Optional[str] = None
    filename: str
    model: str
    transcript: str
    chunks: list[SpeechChunk] = Field(default_factory=list)
    summary: Optional[str] = None
    topics: list[str] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list)
    knowledge_graph: Optional[SpeechKnowledgeGraph] = None
    raw: dict[str, Any] = Field(default_factory=dict)


class SpeechHealthResponse(BaseModel):
    configured: bool
    service_url: str
    status: str
