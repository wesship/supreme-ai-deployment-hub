"""Provider contracts and configuration health for AI Film Studio."""
from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class ProviderSpec:
    capability: str
    provider: str
    required_env: tuple[str, ...] = ()
    optional_env: tuple[str, ...] = ()
    required_binary: tuple[str, ...] = ()

    def configured(self, environ: Mapping[str, str] | None = None) -> bool:
        source = environ or os.environ
        env_ready = all(bool(source.get(name, "").strip()) for name in self.required_env)
        binary_ready = all(shutil.which(name) is not None for name in self.required_binary)
        return env_ready and binary_ready


PROVIDER_SPECS: tuple[ProviderSpec, ...] = (
    ProviderSpec("image", "openai", ("OPENAI_API_KEY",), ("AI_FILM_IMAGE_MODEL",)),
    ProviderSpec("image", "replicate", ("REPLICATE_API_TOKEN",), ("AI_FILM_REPLICATE_IMAGE_MODEL",)),
    ProviderSpec("video", "wan", ("D3VONN_WAN_VIDEO_RUNNER",), ("D3VONN_WAN_VIDEO_MODEL",)),
    ProviderSpec("video", "ltx", ("D3VONN_LTX_VIDEO_RUNNER",), ("D3VONN_LTX_VIDEO_MODEL",)),
    ProviderSpec("video", "openai", ("OPENAI_API_KEY",), ("AI_FILM_OPENAI_VIDEO_MODEL",)),
    ProviderSpec("video", "higgsfield", ("HIGGSFIELD_API_KEY",), ("AI_FILM_HIGGSFIELD_VIDEO_MODEL", "HIGGSFIELD_API_BASE_URL")),
    ProviderSpec("video", "xai", ("XAI_API_KEY",), ("AI_FILM_XAI_VIDEO_MODEL", "XAI_API_BASE_URL")),
    ProviderSpec("video", "movieflow", ("MOVIEFLOW_API_KEY",), ("AI_FILM_MOVIEFLOW_VIDEO_MODEL", "MOVIEFLOW_API_BASE_URL")),
    ProviderSpec("video", "pollo", ("POLLO_API_KEY",), ("POLLO_API_BASE_URL", "POLLO_WEBHOOK_URL")),
    ProviderSpec("commerce_generation", "pollo", ("POLLO_API_KEY", "POLLO_WEBHOOK_URL", "POLLO_WEBHOOK_SECRET"), ("POLLO_API_BASE_URL",)),
    ProviderSpec("video", "runway", ("RUNWAY_API_KEY",), ("AI_FILM_RUNWAY_MODEL",)),
    ProviderSpec("video", "replicate", ("REPLICATE_API_TOKEN", "AI_FILM_REPLICATE_VIDEO_MODEL")),
    ProviderSpec("avatar", "replicate", ("REPLICATE_API_TOKEN", "AI_FILM_REPLICATE_AVATAR_MODEL")),
    ProviderSpec("character_replacement", "replicate", ("REPLICATE_API_TOKEN", "AI_FILM_REPLICATE_CHARACTER_MODEL")),
    ProviderSpec("lip_sync", "replicate", ("REPLICATE_API_TOKEN", "AI_FILM_REPLICATE_LIPSYNC_MODEL")),
    ProviderSpec("virtual_try_on", "pollo", ("POLLO_API_KEY",), ("POLLO_API_BASE_URL",)),
    ProviderSpec("product_image", "pollo", ("POLLO_API_KEY",), ("POLLO_API_BASE_URL",)),
    ProviderSpec("assembly", "ffmpeg", required_binary=("ffmpeg",)),
    ProviderSpec("voice", "elevenlabs", ("ELEVENLABS_API_KEY",), ("ELEVENLABS_VOICE_ID",)),
    ProviderSpec("voice", "openai", ("OPENAI_API_KEY",), ("AI_FILM_VOICE_MODEL",)),
    ProviderSpec("music", "suno", ("SUNO_API_KEY",), ("AI_FILM_SUNO_MODEL",)),
    ProviderSpec("music", "replicate", ("REPLICATE_API_TOKEN",), ("AI_FILM_REPLICATE_MUSIC_MODEL",)),
    ProviderSpec("video_intelligence", "twelvelabs", ("TWELVELABS_API_KEY", "TWELVELABS_KNOWLEDGE_STORE_ID"), ("TWELVELABS_API_BASE_URL",)),
    ProviderSpec("email", "resend", ("RESEND_API_KEY", "AI_FILM_EMAIL_FROM")),
    ProviderSpec("publishing", "youtube", ("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN")),
    ProviderSpec("publishing", "vimeo", ("VIMEO_ACCESS_TOKEN",)),
)


def provider_health(environ: Mapping[str, str] | None = None) -> dict[str, object]:
    providers = [
        {
            "capability": spec.capability,
            "provider": spec.provider,
            "status": "configured" if spec.configured(environ) else "not_configured",
            "required_env": list(spec.required_env),
            "optional_env": list(spec.optional_env),
            "required_binary": list(spec.required_binary),
        }
        for spec in PROVIDER_SPECS
    ]
    capabilities = sorted({spec.capability for spec in PROVIDER_SPECS})
    summary = {
        capability: any(
            item["capability"] == capability and item["status"] == "configured"
            for item in providers
        )
        for capability in capabilities
    }
    return {"providers": providers, "capabilities": summary}


def validate_provider(capability: str, provider: str) -> ProviderSpec:
    for spec in PROVIDER_SPECS:
        if spec.capability == capability and spec.provider == provider:
            if not spec.configured():
                missing_env = [name for name in spec.required_env if not os.getenv(name)]
                missing_binary = [name for name in spec.required_binary if shutil.which(name) is None]
                missing = [*missing_env, *[f"binary:{name}" for name in missing_binary]]
                raise RuntimeError(
                    f"{capability} provider '{provider}' is not configured; missing: {', '.join(missing)}"
                )
            return spec
    raise ValueError(f"Unsupported AI Film provider: {capability}/{provider}")
