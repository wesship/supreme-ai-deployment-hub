# Devonn.AI — Digital Human Interface Layer

The Digital Human Interface Layer provides avatar-based interaction capabilities for Devonn.AI agents. It serves as the **face and body layer** for existing agents, transforming text and voice responses into expressive, real-time animated portrait videos.

This module is not the core brain — it is the presentation layer that makes Devonn.AI agents visible and personable to end users through live-streamed digital human avatars.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React UI Client                      │
│              (WebRTC / HLS Video Player)                 │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              FastAPI Avatar Gateway                       │
│         (Session management, routing, auth)              │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│           Agent Orchestrator / Hermes                     │
│      (LLM response generation, intent routing)           │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                 Voice Engine                              │
│    (TTS: ElevenLabs / OpenAI / Edge-TTS / Coqui)        │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              PersonaLive Service                          │
│   (Audio-driven portrait animation, GPU inference)       │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              Streaming Output                             │
│         (WebRTC / RTMP / HLS delivery)                   │
└─────────────────────────────────────────────────────────┘
```

## Supported Backends

| Backend | License | Status | Notes |
|---------|---------|--------|-------|
| PersonaLive (GVCLab) | Apache-2.0 | **Primary** | CVPR 2026, real-time diffusion, infinite-length |
| PersonaLive (neosun100 fork) | Apache-2.0 | **Production Docker** | REST API, MCP, Docker all-in-one |

## Use Cases

| Use Case | Description | Avatar Type |
|----------|-------------|-------------|
| Insurance Sales Avatar | AI agent that presents insurance products with human-like presence | Professional, trust-building |
| Class 1 AI Tutor | Educational avatar for personalized learning | Friendly, expressive |
| Website Support Avatar | Customer service digital human embedded in websites | Branded, helpful |
| Smart Glasses Assistant | Lightweight avatar for AR/XR wearable interfaces | Minimal, responsive |
| Digital Employee Dashboard | Internal-facing avatar for enterprise dashboards | Corporate, informative |

## Quick Start

```bash
# Start the PersonaLive service (GPU required)
docker compose -f devonn-avatar-layer/personalive/docker-compose.yml up -d

# Start the Avatar Gateway
cd devonn-avatar-layer/personalive
python -m uvicorn src.gateway:app --host 0.0.0.0 --port 8100

# The avatar is now accessible at http://localhost:8100
```

## Module Structure

```
devonn-avatar-layer/
├── README.md                    # This file
└── personalive/
    ├── config/                  # Configuration files
    │   ├── settings.yaml        # Service configuration
    │   └── avatars/             # Avatar persona definitions
    ├── docs/                    # Documentation
    │   ├── KNOWLEDGE_BASE.md    # PersonaLive technical reference
    │   ├── INTEGRATION.md       # Integration guide
    │   └── API.md               # API reference
    ├── src/                     # Source code
    │   ├── gateway.py           # FastAPI Avatar Gateway
    │   ├── voice_engine.py      # TTS integration
    │   ├── personalive_client.py # PersonaLive service client
    │   ├── session_manager.py   # Session lifecycle management
    │   └── stream_output.py     # WebRTC/HLS streaming
    ├── tests/                   # Test suite
    ├── docker-compose.yml       # Docker deployment
    └── requirements.txt         # Python dependencies
```
