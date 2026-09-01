"""Strict configuration for the localhost-only D3VONN Portable AI gateway."""

from __future__ import annotations

import ipaddress
import os
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit


def _loopback_ip(value: str, *, field: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address:
    try:
        address = ipaddress.ip_address(value)
    except ValueError as exc:
        raise ValueError(f"{field} must be a loopback IP literal") from exc
    if not address.is_loopback:
        raise ValueError(f"{field} must be a loopback IP literal")
    return address


def validate_bind(value: str) -> str:
    """Reject wildcard, LAN, and hostname binds, including a mutable localhost name."""

    return str(_loopback_ip(value.strip(), field="D3VONN_BIND"))


def validate_local_endpoint(value: str) -> str:
    """Accept only an explicit HTTP(S) loopback endpoint with no ambiguous URL parts."""

    candidate = value.strip().rstrip("/")
    parsed = urlsplit(candidate)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("D3VONN_LLAMA_URL must use http or https")
    if not parsed.hostname:
        raise ValueError("D3VONN_LLAMA_URL must include a host")
    _loopback_ip(parsed.hostname, field="D3VONN_LLAMA_URL host")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("D3VONN_LLAMA_URL cannot include credentials, query, or fragment")
    try:
        parsed.port
    except ValueError as exc:
        raise ValueError("D3VONN_LLAMA_URL has an invalid port") from exc
    return candidate


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


def _bounded_float(name: str, default: float, minimum: float, maximum: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError as exc:
        raise ValueError(f"{name} must be numeric") from exc
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


def load_env_file(path: Path) -> None:
    """Load a small data-only env file without executing shell or PowerShell syntax."""

    if not path.is_file():
        return
    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"invalid .env entry on line {line_number}")
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not re.fullmatch(r"D3VONN_[A-Z0-9_]+", key):
            raise ValueError(f"unsupported .env key on line {line_number}")
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if "\x00" in value or "\n" in value or "\r" in value:
            raise ValueError(f"invalid .env value on line {line_number}")
        os.environ.setdefault(key, value)


@dataclass(frozen=True)
class RuntimeConfig:
    bind: str
    port: int
    llama_url: str
    max_tokens: int
    temperature: float
    max_chat_bytes: int
    max_audio_bytes: int
    max_upstream_bytes: int
    upstream_timeout_seconds: int
    whisper_bin: str
    whisper_model: str
    whisper_timeout_seconds: int
    log_requests: bool

    @classmethod
    def from_environment(cls) -> "RuntimeConfig":
        offline = os.getenv("D3VONN_OFFLINE", "1")
        if offline != "1":
            raise ValueError("D3VONN_OFFLINE must remain 1 for the portable runtime")
        return cls(
            bind=validate_bind(os.getenv("D3VONN_BIND", "127.0.0.1")),
            port=_bounded_int("D3VONN_PORT", 8787, 1024, 65535),
            llama_url=validate_local_endpoint(
                os.getenv("D3VONN_LLAMA_URL", "http://127.0.0.1:8080")
            ),
            max_tokens=_bounded_int("D3VONN_MAX_TOKENS", 512, 1, 8192),
            temperature=_bounded_float("D3VONN_TEMPERATURE", 0.2, 0.0, 2.0),
            max_chat_bytes=_bounded_int("D3VONN_MAX_CHAT_BYTES", 65536, 1024, 1048576),
            max_audio_bytes=_bounded_int(
                "D3VONN_MAX_AUDIO_BYTES", 25 * 1024 * 1024, 1024, 100 * 1024 * 1024
            ),
            max_upstream_bytes=_bounded_int(
                "D3VONN_MAX_UPSTREAM_BYTES", 4 * 1024 * 1024, 1024, 16 * 1024 * 1024
            ),
            upstream_timeout_seconds=_bounded_int(
                "D3VONN_UPSTREAM_TIMEOUT_SECONDS", 120, 1, 600
            ),
            whisper_bin=os.getenv("D3VONN_WHISPER_BIN", "whisper-cli").strip(),
            whisper_model=os.getenv("D3VONN_WHISPER_MODEL", "").strip(),
            whisper_timeout_seconds=_bounded_int(
                "D3VONN_WHISPER_TIMEOUT_SECONDS", 120, 1, 600
            ),
            log_requests=os.getenv("D3VONN_LOG", "1") == "1",
        )
