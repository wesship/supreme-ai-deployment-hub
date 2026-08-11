"""Provider contracts and configuration health for AI Film Studio."""
from __future__ import annotations

import json
import os
import re
import shutil
from dataclasses import dataclass
from typing import Iterable, Mapping


_PROVIDER_ID = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")
_CAPABILITY_ID = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")


@dataclass(frozen=True)
class ProviderSpec:
    capability: str
    provider: str
    required_env: tuple[str, ...] = ()
    optional_env: tuple[str, ...] = ()
    required_binary: tuple[str, ...] = ()
    model_env: str | None = None
    source: str = "builtin"

    def configured(self, environ: Mapping[str, str] | None = None) -> bool:
        source = environ or os.environ
        env_ready = all(bool(source.get(name, "").strip()) for name in self.required_env)
        binary_ready = all(shutil.which(name) is not None for name in self.required_binary)
        return env_ready and binary_ready


PROVIDER_SPECS: tuple[ProviderSpec, ...] = (
    ProviderSpec("image", "openai", ("OPENAI_API_KEY",), ("AI_FILM_IMAGE_MODEL",), model_env="AI_FILM_IMAGE_MODEL"),
    ProviderSpec("image", "replicate", ("REPLICATE_API_TOKEN",), ("AI_FILM_REPLICATE_IMAGE_MODEL",), model_env="AI_FILM_REPLICATE_IMAGE_MODEL"),
    ProviderSpec("image", "kling", ("KLING_ACCESS_KEY", "KLING_SECRET_KEY"), ("AI_FILM_KLING_IMAGE_MODEL", "KLING_API_BASE_URL"), model_env="AI_FILM_KLING_IMAGE_MODEL"),
    ProviderSpec("video", "openai", ("OPENAI_API_KEY",), ("AI_FILM_OPENAI_VIDEO_MODEL",), model_env="AI_FILM_OPENAI_VIDEO_MODEL"),
    ProviderSpec("video", "higgsfield", ("HIGGSFIELD_API_KEY",), ("AI_FILM_HIGGSFIELD_VIDEO_MODEL", "HIGGSFIELD_API_BASE_URL"), model_env="AI_FILM_HIGGSFIELD_VIDEO_MODEL"),
    ProviderSpec("video", "xai", ("XAI_API_KEY",), ("AI_FILM_XAI_VIDEO_MODEL", "XAI_API_BASE_URL"), model_env="AI_FILM_XAI_VIDEO_MODEL"),
    ProviderSpec("video", "movieflow", ("MOVIEFLOW_API_KEY",), ("AI_FILM_MOVIEFLOW_VIDEO_MODEL", "MOVIEFLOW_API_BASE_URL"), model_env="AI_FILM_MOVIEFLOW_VIDEO_MODEL"),
    ProviderSpec("video", "pollo", ("POLLO_API_KEY",), ("POLLO_API_BASE_URL", "POLLO_WEBHOOK_URL")),
    ProviderSpec("commerce_generation", "pollo", ("POLLO_API_KEY", "POLLO_WEBHOOK_URL", "POLLO_WEBHOOK_SECRET"), ("POLLO_API_BASE_URL",)),
    ProviderSpec("video", "runway", ("RUNWAY_API_KEY",), ("AI_FILM_RUNWAY_MODEL",), model_env="AI_FILM_RUNWAY_MODEL"),
    ProviderSpec("video", "replicate", ("REPLICATE_API_TOKEN", "AI_FILM_REPLICATE_VIDEO_MODEL"), model_env="AI_FILM_REPLICATE_VIDEO_MODEL"),
    ProviderSpec("video", "kling", ("KLING_ACCESS_KEY", "KLING_SECRET_KEY"), ("AI_FILM_KLING_VIDEO_MODEL", "KLING_API_BASE_URL"), model_env="AI_FILM_KLING_VIDEO_MODEL"),
    ProviderSpec("video", "invideo", ("INVIDEO_API_KEY",), ("AI_FILM_INVIDEO_VIDEO_MODEL", "INVIDEO_API_BASE_URL", "INVIDEO_MCP_URL"), model_env="AI_FILM_INVIDEO_VIDEO_MODEL"),
    ProviderSpec("avatar", "replicate", ("REPLICATE_API_TOKEN", "AI_FILM_REPLICATE_AVATAR_MODEL"), model_env="AI_FILM_REPLICATE_AVATAR_MODEL"),
    ProviderSpec("character_replacement", "replicate", ("REPLICATE_API_TOKEN", "AI_FILM_REPLICATE_CHARACTER_MODEL"), model_env="AI_FILM_REPLICATE_CHARACTER_MODEL"),
    ProviderSpec("lip_sync", "replicate", ("REPLICATE_API_TOKEN", "AI_FILM_REPLICATE_LIPSYNC_MODEL"), model_env="AI_FILM_REPLICATE_LIPSYNC_MODEL"),
    ProviderSpec("virtual_try_on", "pollo", ("POLLO_API_KEY",), ("POLLO_API_BASE_URL",)),
    ProviderSpec("product_image", "pollo", ("POLLO_API_KEY",), ("POLLO_API_BASE_URL",)),
    ProviderSpec("assembly", "ffmpeg", required_binary=("ffmpeg",)),
    ProviderSpec("voice", "elevenlabs", ("ELEVENLABS_API_KEY",), ("ELEVENLABS_VOICE_ID",)),
    ProviderSpec("voice", "openai", ("OPENAI_API_KEY",), ("AI_FILM_VOICE_MODEL",), model_env="AI_FILM_VOICE_MODEL"),
    ProviderSpec("music", "suno", ("SUNO_API_KEY",), ("AI_FILM_SUNO_MODEL",), model_env="AI_FILM_SUNO_MODEL"),
    ProviderSpec("music", "replicate", ("REPLICATE_API_TOKEN",), ("AI_FILM_REPLICATE_MUSIC_MODEL",), model_env="AI_FILM_REPLICATE_MUSIC_MODEL"),
    ProviderSpec("video_intelligence", "twelvelabs", ("TWELVELABS_API_KEY", "TWELVELABS_KNOWLEDGE_STORE_ID"), ("TWELVELABS_API_BASE_URL",)),
    ProviderSpec("email", "resend", ("RESEND_API_KEY", "AI_FILM_EMAIL_FROM")),
    ProviderSpec("publishing", "youtube", ("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN")),
    ProviderSpec("publishing", "vimeo", ("VIMEO_ACCESS_TOKEN",)),
)


def _env_names(value: object, *, field: str) -> tuple[str, ...]:
    if value is None:
        return ()
    if not isinstance(value, list) or not all(isinstance(item, str) and item for item in value):
        raise ValueError(f"Custom provider {field} must be an array of environment variable names")
    names = tuple(value)
    if any(name.startswith("VITE_") for name in names):
        raise ValueError("AI Film provider credentials must be server-side; VITE_* is forbidden")
    return names


def custom_provider_specs(environ: Mapping[str, str] | None = None) -> tuple[ProviderSpec, ...]:
    """Load additive providers from protected runtime configuration.

    AI_FILM_CUSTOM_PROVIDERS_JSON is a JSON array. Each entry accepts capability,
    provider, required_env, optional_env, required_binary, and model_env. Built-in
    provider/capability pairs cannot be overridden.
    """
    source = environ or os.environ
    raw = str(source.get("AI_FILM_CUSTOM_PROVIDERS_JSON", "")).strip()
    if not raw:
        return ()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("AI_FILM_CUSTOM_PROVIDERS_JSON is invalid JSON") from exc
    if not isinstance(payload, list):
        raise ValueError("AI_FILM_CUSTOM_PROVIDERS_JSON must be a JSON array")

    builtins = {(spec.capability, spec.provider) for spec in PROVIDER_SPECS}
    seen: set[tuple[str, str]] = set()
    result: list[ProviderSpec] = []
    for item in payload:
        if not isinstance(item, dict):
            raise ValueError("Each custom provider must be a JSON object")
        capability = str(item.get("capability", "")).strip().lower()
        provider = str(item.get("provider", "")).strip().lower()
        if not _CAPABILITY_ID.fullmatch(capability) or not _PROVIDER_ID.fullmatch(provider):
            raise ValueError("Custom provider capability/provider identifiers are invalid")
        key = (capability, provider)
        if key in builtins or key in seen:
            raise ValueError(f"Duplicate or built-in provider contract: {capability}/{provider}")
        required_env = _env_names(item.get("required_env"), field="required_env")
        optional_env = _env_names(item.get("optional_env"), field="optional_env")
        required_binary = _env_names(item.get("required_binary"), field="required_binary")
        model_env = item.get("model_env")
        if model_env is not None:
            if not isinstance(model_env, str) or not model_env or model_env.startswith("VITE_"):
                raise ValueError("Custom provider model_env must be a server-side environment variable")
        if not required_env and not required_binary:
            raise ValueError(f"Custom provider {capability}/{provider} has no runtime contract")
        result.append(
            ProviderSpec(
                capability=capability,
                provider=provider,
                required_env=required_env,
                optional_env=optional_env,
                required_binary=required_binary,
                model_env=model_env,
                source="custom",
            )
        )
        seen.add(key)
    return tuple(result)


def provider_specs(environ: Mapping[str, str] | None = None) -> tuple[ProviderSpec, ...]:
    return (*PROVIDER_SPECS, *custom_provider_specs(environ))


def register_provider(
    registry: Iterable[ProviderSpec],
    spec: ProviderSpec,
) -> tuple[ProviderSpec, ...]:
    """Pure helper for tests/plugins; production persistence uses the JSON registry."""
    items = tuple(registry)
    if any((item.capability, item.provider) == (spec.capability, spec.provider) for item in items):
        raise ValueError(f"Provider already registered: {spec.capability}/{spec.provider}")
    return (*items, spec)


def provider_health(environ: Mapping[str, str] | None = None) -> dict[str, object]:
    specs = provider_specs(environ)
    providers = [
        {
            "capability": spec.capability,
            "provider": spec.provider,
            "status": "configured" if spec.configured(environ) else "not_configured",
            "required_env": list(spec.required_env),
            "optional_env": list(spec.optional_env),
            "required_binary": list(spec.required_binary),
            "model_env": spec.model_env,
            "source": spec.source,
        }
        for spec in specs
    ]
    capabilities = sorted({spec.capability for spec in specs})
    summary = {
        capability: any(
            item["capability"] == capability and item["status"] == "configured"
            for item in providers
        )
        for capability in capabilities
    }
    return {"providers": providers, "capabilities": summary}


def validate_provider(
    capability: str,
    provider: str,
    environ: Mapping[str, str] | None = None,
) -> ProviderSpec:
    source = environ or os.environ
    for spec in provider_specs(source):
        if spec.capability == capability and spec.provider == provider:
            if not spec.configured(source):
                missing_env = [name for name in spec.required_env if not source.get(name)]
                missing_binary = [name for name in spec.required_binary if shutil.which(name) is None]
                missing = [*missing_env, *[f"binary:{name}" for name in missing_binary]]
                raise RuntimeError(
                    f"{capability} provider '{provider}' is not configured; missing: {', '.join(missing)}"
                )
            return spec
    raise ValueError(f"Unsupported AI Film provider: {capability}/{provider}")
