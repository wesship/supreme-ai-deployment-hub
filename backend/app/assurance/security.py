"""Network and message security primitives for the assurance platform."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import ipaddress
import json
import socket
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import urlsplit, urlunsplit


class UnsafeRemoteTarget(ValueError):
    """Raised when a supplied remote destination is not safe for server-side use."""


@dataclass(frozen=True)
class VerifiedRemoteTarget:
    url: str
    hostname: str
    port: int
    addresses: tuple[str, ...]


def _is_globally_routable(address: str) -> bool:
    candidate = ipaddress.ip_address(address)
    return bool(candidate.is_global and not candidate.is_loopback and not candidate.is_private)


async def _resolve_public_addresses(hostname: str, port: int) -> tuple[str, ...]:
    loop = asyncio.get_running_loop()
    try:
        records = await loop.getaddrinfo(
            hostname,
            port,
            family=socket.AF_UNSPEC,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise UnsafeRemoteTarget("Gateway hostname could not be resolved") from exc

    addresses = tuple(sorted({record[4][0] for record in records if record[4]}))
    if not addresses:
        raise UnsafeRemoteTarget("Gateway hostname did not resolve to an address")
    if any(not _is_globally_routable(address) for address in addresses):
        raise UnsafeRemoteTarget("Gateway resolves to a non-public network address")
    return addresses


def _normalise_https_url(raw_url: str) -> tuple[str, str, int]:
    parsed = urlsplit(raw_url.strip())
    if parsed.scheme != "https":
        raise UnsafeRemoteTarget("Only HTTPS gateway and webhook endpoints are allowed")
    if parsed.username or parsed.password:
        raise UnsafeRemoteTarget("Endpoint credentials must not be embedded in a URL")
    if not parsed.hostname:
        raise UnsafeRemoteTarget("Endpoint hostname is required")
    try:
        port = parsed.port or 443
    except ValueError as exc:
        raise UnsafeRemoteTarget("Endpoint port is invalid") from exc
    if not 1 <= port <= 65535:
        raise UnsafeRemoteTarget("Endpoint port is invalid")

    hostname = parsed.hostname.rstrip(".").lower()
    try:
        hostname = hostname.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise UnsafeRemoteTarget("Endpoint hostname is invalid") from exc

    path = parsed.path or "/"
    normalized = urlunsplit(("https", f"{hostname}:{port}" if port != 443 else hostname, path, parsed.query, ""))
    return normalized, hostname, port


async def verify_public_https_target(
    raw_url: str,
    *,
    expected_addresses: Iterable[str] | None = None,
) -> VerifiedRemoteTarget:
    """Validate an HTTPS target before and after DNS resolution.

    The second resolution detects DNS rebinding or address changes between gateway
    registration and execution. A deployment egress policy must additionally deny
    private and metadata networks; application validation is defense in depth.
    """
    url, hostname, port = _normalise_https_url(raw_url)
    first_resolution = await _resolve_public_addresses(hostname, port)
    second_resolution = await _resolve_public_addresses(hostname, port)
    if any(not _is_globally_routable(address) for address in (*first_resolution, *second_resolution)):
        raise UnsafeRemoteTarget("Gateway resolves to a non-public network address")
    if first_resolution != second_resolution:
        raise UnsafeRemoteTarget("Endpoint DNS resolution changed during validation")

    if expected_addresses is not None and set(first_resolution) != set(expected_addresses):
        raise UnsafeRemoteTarget("Endpoint DNS resolution does not match the approved gateway record")

    return VerifiedRemoteTarget(
        url=url,
        hostname=hostname,
        port=port,
        addresses=first_resolution,
    )


def build_webhook_signature(secret: str, body: dict[str, object]) -> str:
    payload = json.dumps(body, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
