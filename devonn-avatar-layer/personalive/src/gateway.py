"""
Devonn.AI Avatar Gateway
=========================
FastAPI service that orchestrates the full avatar pipeline:
User Message → LLM Response → Voice Generation → PersonaLive Animation → Streaming Output
"""

import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .personalive_client import PersonaLiveClient
from .session_manager import SessionManager
from .voice_engine import VoiceEngine

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PERSONALIVE_URL = os.getenv("PERSONALIVE_URL", "http://localhost:7870")
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:8000")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
DEVONN_API_KEY = os.getenv("DEVONN_API_KEY", "")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")


# ---------------------------------------------------------------------------
# Application Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and tear down shared resources."""
    app.state.personalive = PersonaLiveClient(base_url=PERSONALIVE_URL)
    app.state.voice_engine = VoiceEngine(
        openai_api_key=OPENAI_API_KEY,
        elevenlabs_api_key=ELEVENLABS_API_KEY,
    )
    app.state.session_manager = SessionManager(max_sessions=20)

    logger.info("Avatar Gateway starting — PersonaLive: %s", PERSONALIVE_URL)
    yield

    await app.state.session_manager.close_all()
    logger.info("Avatar Gateway shutting down")


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Devonn.AI Avatar Gateway",
    description="Digital Human Interface Layer — orchestrates LLM → Voice → PersonaLive → Stream",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """User message to the avatar agent."""
    message: str = Field(..., description="User's text message")
    session_id: Optional[str] = Field(None, description="Existing session ID")
    persona: str = Field("default", description="Avatar persona to use")


class ChatResponse(BaseModel):
    """Response from the avatar agent."""
    session_id: str
    text_response: str
    audio_url: Optional[str] = None
    video_url: Optional[str] = None
    status: str = "completed"


class SessionInfo(BaseModel):
    """Information about an active avatar session."""
    session_id: str
    persona: str
    created_at: str
    status: str
    duration_seconds: float


class AvatarPersona(BaseModel):
    """Avatar persona configuration."""
    name: str
    role: str
    reference_image: str
    voice_provider: str = "openai"
    voice_id: str = "alloy"


# ---------------------------------------------------------------------------
# Health & Status Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """System health check including PersonaLive service status."""
    personalive_healthy = await app.state.personalive.check_health()
    return {
        "status": "healthy" if personalive_healthy else "degraded",
        "gateway": "running",
        "personalive": "connected" if personalive_healthy else "disconnected",
        "active_sessions": app.state.session_manager.active_count,
    }


@app.get("/gpu/status")
async def gpu_status():
    """Get GPU utilization from PersonaLive service."""
    status = await app.state.personalive.get_gpu_status()
    if status is None:
        raise HTTPException(status_code=503, detail="PersonaLive service unavailable")
    return status


@app.get("/sessions", response_model=list[SessionInfo])
async def list_sessions():
    """List all active avatar sessions."""
    return app.state.session_manager.list_sessions()


# ---------------------------------------------------------------------------
# Core Avatar Interaction Endpoints
# ---------------------------------------------------------------------------

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Full avatar interaction pipeline:
    1. Get or create session
    2. Send message to Agent Orchestrator for LLM response
    3. Convert response to speech via Voice Engine
    4. Animate avatar via PersonaLive
    5. Return video/audio URLs
    """
    # Get or create session
    session = app.state.session_manager.get_or_create(
        session_id=request.session_id,
        persona=request.persona,
    )

    # Step 1: Get LLM response from orchestrator
    text_response = await _get_llm_response(request.message, session.persona)

    # Step 2: Generate speech audio
    audio_bytes = await app.state.voice_engine.synthesize(
        text=text_response,
        provider=session.voice_provider,
        voice_id=session.voice_id,
    )

    # Step 3: Animate avatar with audio
    video_result = await app.state.personalive.animate(
        reference_image=session.reference_image_path,
        audio_data=audio_bytes,
        session_id=session.session_id,
    )

    return ChatResponse(
        session_id=session.session_id,
        text_response=text_response,
        audio_url=video_result.get("audio_url"),
        video_url=video_result.get("video_url"),
        status="completed",
    )


@app.post("/sessions/{session_id}/speak")
async def speak(session_id: str, text: str):
    """Make the avatar speak a specific text (bypasses LLM)."""
    session = app.state.session_manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    audio_bytes = await app.state.voice_engine.synthesize(
        text=text,
        provider=session.voice_provider,
        voice_id=session.voice_id,
    )

    video_result = await app.state.personalive.animate(
        reference_image=session.reference_image_path,
        audio_data=audio_bytes,
        session_id=session_id,
    )

    return {"video_url": video_result.get("video_url"), "status": "completed"}


@app.delete("/sessions/{session_id}")
async def close_session(session_id: str):
    """Close an avatar session and release resources."""
    closed = app.state.session_manager.close(session_id)
    if not closed:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "closed", "session_id": session_id}


# ---------------------------------------------------------------------------
# WebSocket Streaming Endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/avatar/{session_id}")
async def avatar_stream(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time avatar streaming.
    Client sends text messages, server streams back video frames.
    """
    await websocket.accept()

    session = app.state.session_manager.get_or_create(
        session_id=session_id,
        persona="default",
    )

    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "")

            if not message:
                continue

            # Get LLM response
            text_response = await _get_llm_response(message, session.persona)

            # Send text response immediately
            await websocket.send_json({
                "type": "text",
                "content": text_response,
            })

            # Generate and stream audio/video
            audio_bytes = await app.state.voice_engine.synthesize(
                text=text_response,
                provider=session.voice_provider,
                voice_id=session.voice_id,
            )

            video_result = await app.state.personalive.animate(
                reference_image=session.reference_image_path,
                audio_data=audio_bytes,
                session_id=session_id,
            )

            await websocket.send_json({
                "type": "video",
                "url": video_result.get("video_url"),
                "audio_url": video_result.get("audio_url"),
            })

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: session %s", session_id)
        app.state.session_manager.close(session_id)


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------

async def _get_llm_response(message: str, persona: str) -> str:
    """Get LLM response from the Agent Orchestrator."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{ORCHESTRATOR_URL}/api/v1/chat",
                json={
                    "message": message,
                    "persona": persona,
                    "stream": False,
                },
                headers={"Authorization": f"Bearer {DEVONN_API_KEY}"},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", data.get("message", "I'm here to help."))
    except Exception as e:
        logger.warning("Orchestrator unavailable (%s), using fallback", str(e))
        # Fallback: use OpenAI directly if orchestrator is down
        return await _fallback_llm_response(message, persona)


async def _fallback_llm_response(message: str, persona: str) -> str:
    """Fallback LLM response using OpenAI directly."""
    if not OPENAI_API_KEY:
        return "I'm currently unable to process your request. Please try again later."

    import httpx

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": f"You are a helpful AI assistant with persona: {persona}. Keep responses concise and conversational."},
                        {"role": "user", "content": message},
                    ],
                    "max_tokens": 200,
                },
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error("Fallback LLM also failed: %s", str(e))
        return "I'm here to help. Could you please repeat your question?"
