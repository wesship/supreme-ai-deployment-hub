#!/usr/bin/env python3
"""Fail-closed localhost gateway for D3VONN Portable AI."""

from __future__ import annotations

import http.client
import ipaddress
import json
import os
import socket
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from config import RuntimeConfig, load_env_file
from voice import transcribe_wav

ROOT = Path(__file__).resolve().parents[1]
WEB_ROOT = ROOT / "web"
MAX_MESSAGE_CHARS = 32_000


class PublicError(Exception):
    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        raise RuntimeError("Local inference endpoint attempted a redirect")


LOCAL_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


def _is_loopback_literal(value: str | None) -> bool:
    if not value:
        return False
    try:
        return ipaddress.ip_address(value).is_loopback
    except ValueError:
        return False


def _host_matches_loopback(host_header: str | None, server_port: int) -> bool:
    if not host_header:
        return False
    try:
        parsed = urlsplit(f"http://{host_header}")
        return (
            _is_loopback_literal(parsed.hostname)
            and parsed.port == server_port
            and not parsed.username
            and not parsed.password
        )
    except ValueError:
        return False


def _origin_matches_loopback(origin: str | None, server_port: int) -> bool:
    if origin is None:
        return True
    try:
        parsed = urlsplit(origin)
        return (
            parsed.scheme == "http"
            and _is_loopback_literal(parsed.hostname)
            and parsed.port == server_port
            and not parsed.username
            and not parsed.password
            and parsed.path in {"", "/"}
            and not parsed.query
            and not parsed.fragment
        )
    except ValueError:
        return False


def local_llama(config: RuntimeConfig, message: str) -> str:
    payload = json.dumps(
        {
            "messages": [{"role": "user", "content": message}],
            "max_tokens": config.max_tokens,
            "temperature": config.temperature,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{config.llama_url}/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with LOCAL_OPENER.open(request, timeout=config.upstream_timeout_seconds) as response:
        raw = response.read(config.max_upstream_bytes + 1)
    if len(raw) > config.max_upstream_bytes:
        raise RuntimeError("Local inference response exceeded the configured limit")
    data = json.loads(raw.decode("utf-8"))
    try:
        answer = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Local inference returned an invalid response") from exc
    if not isinstance(answer, str):
        raise RuntimeError("Local inference returned an invalid response")
    return answer


class PortableServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def __init__(self, address: tuple[str, int], config: RuntimeConfig):
        bind_address = str(ipaddress.ip_address(address[0]))
        if not ipaddress.ip_address(bind_address).is_loopback or bind_address != config.bind:
            raise ValueError("PortableServer must bind to its configured loopback address")
        self.address_family = socket.AF_INET6 if ":" in bind_address else socket.AF_INET
        self.config = config
        self.execution_slots = threading.BoundedSemaphore(1)
        super().__init__(address, Handler)


class Handler(BaseHTTPRequestHandler):
    server: PortableServer
    protocol_version = "HTTP/1.0"
    server_version = "D3VONNPortableAI/1"
    sys_version = ""

    def version_string(self) -> str:
        return self.server_version

    def log_message(self, fmt: str, *args: object) -> None:
        if self.server.config.log_requests:
            super().log_message(fmt, *args)

    def _headers(self, status: int, content_type: str, length: int) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()

    def _json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self._headers(status, "application/json; charset=utf-8", len(body))
        self.wfile.write(body)

    def _check_request_boundary(self) -> None:
        server_port = self.server.server_address[1]
        if not _host_matches_loopback(self.headers.get("Host"), server_port):
            raise PublicError(403, "invalid_host")
        if not _origin_matches_loopback(self.headers.get("Origin"), server_port):
            raise PublicError(403, "invalid_origin")
        if self.headers.get("Transfer-Encoding"):
            raise PublicError(400, "transfer_encoding_not_supported")

    def _read_body(self, maximum: int, expected_types: set[str]) -> bytes:
        lengths = self.headers.get_all("Content-Length") or []
        if len(lengths) != 1:
            raise PublicError(411, "content_length_required")
        try:
            length = int(lengths[0])
        except ValueError as exc:
            raise PublicError(400, "invalid_content_length") from exc
        if length <= 0 or length > maximum:
            raise PublicError(413, "request_too_large")
        content_type = self.headers.get_content_type()
        if content_type not in expected_types:
            raise PublicError(415, "unsupported_media_type")
        body = self.rfile.read(length)
        if len(body) != length:
            raise PublicError(400, "incomplete_request_body")
        return body

    def _serve_static(self, name: str, content_type: str) -> None:
        body = (WEB_ROOT / name).read_bytes()
        self._headers(200, content_type, len(body))
        self.wfile.write(body)

    def do_GET(self) -> None:
        try:
            self._check_request_boundary()
            path = urlsplit(self.path).path
            if path == "/health":
                config = self.server.config
                self._json(
                    200,
                    {
                        "ok": True,
                        "service": "d3vonn-portable-ai",
                        "offline": True,
                        "inference": "local-loopback",
                        "voice_configured": bool(config.whisper_model),
                    },
                )
            elif path == "/":
                self._serve_static("index.html", "text/html; charset=utf-8")
            elif path == "/app.js":
                self._serve_static("app.js", "text/javascript; charset=utf-8")
            elif path == "/style.css":
                self._serve_static("style.css", "text/css; charset=utf-8")
            else:
                raise PublicError(404, "not_found")
        except PublicError as exc:
            self._json(exc.status, {"error": exc.code})
        except Exception:
            self.log_error("Unhandled GET failure")
            self._json(500, {"error": "internal_error"})

    def do_POST(self) -> None:
        try:
            self._check_request_boundary()
            config = self.server.config
            path = urlsplit(self.path).path
            if not self.server.execution_slots.acquire(blocking=False):
                raise PublicError(429, "runtime_busy")
            try:
                if path == "/v1/chat":
                    raw = self._read_body(config.max_chat_bytes, {"application/json"})
                    try:
                        payload = json.loads(raw.decode("utf-8"))
                    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                        raise PublicError(400, "invalid_json") from exc
                    message = payload.get("message") if isinstance(payload, dict) else None
                    if not isinstance(message, str) or not message.strip():
                        raise PublicError(400, "message_required")
                    if len(message) > MAX_MESSAGE_CHARS:
                        raise PublicError(413, "message_too_large")
                    answer = local_llama(config, message.strip())
                    self._json(200, {"message": answer, "offline": True})
                elif path == "/v1/transcribe":
                    audio = self._read_body(
                        config.max_audio_bytes, {"audio/wav", "audio/x-wav", "application/octet-stream"}
                    )
                    if len(audio) < 12 or audio[:4] != b"RIFF" or audio[8:12] != b"WAVE":
                        raise PublicError(400, "invalid_wav")
                    text = transcribe_wav(
                        audio,
                        binary=config.whisper_bin,
                        model_path=config.whisper_model,
                        timeout=config.whisper_timeout_seconds,
                    )
                    self._json(200, {"text": text, "offline": True})
                else:
                    raise PublicError(404, "not_found")
            finally:
                self.server.execution_slots.release()
        except PublicError as exc:
            self._json(exc.status, {"error": exc.code})
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, RuntimeError, json.JSONDecodeError):
            self.log_error("Local runtime unavailable")
            self._json(503, {"error": "local_service_unavailable"})
        except (ConnectionError, http.client.HTTPException):
            self.log_error("Local runtime connection failure")
            self._json(503, {"error": "local_service_unavailable"})
        except Exception:
            self.log_error("Unhandled POST failure")
            self._json(500, {"error": "internal_error"})

    def do_OPTIONS(self) -> None:
        self._json(405, {"error": "method_not_allowed"})


def main() -> None:
    load_env_file(ROOT / ".env")
    config = RuntimeConfig.from_environment()
    server = PortableServer((config.bind, config.port), config)
    print(f"D3VONN Portable AI listening on http://{config.bind}:{config.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
