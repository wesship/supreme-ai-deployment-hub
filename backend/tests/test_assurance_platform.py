import asyncio

import pytest

from backend.app.assurance.router import HtmlMetadata
from backend.app.assurance.security import UnsafeRemoteTarget, verify_public_https_target


def test_metadata_parser_collects_initial_response_signals():
    parser = HtmlMetadata()
    parser.feed(
        """<html><head><title>Security | D3VONN.IO</title>
        <meta name=\"description\" content=\"Security controls\" />
        <meta property=\"og:title\" content=\"Security | D3VONN.IO\" />
        <link rel=\"canonical\" href=\"https://www.d3vonn.io/security\" />
        </head></html>"""
    )

    assert parser.title == "Security | D3VONN.IO"
    assert parser.meta[("name", "description")] == "Security controls"
    assert parser.meta[("property", "og:title")] == "Security | D3VONN.IO"
    assert parser.canonical == "https://www.d3vonn.io/security"


def test_gateway_validator_rejects_non_https_before_dns():
    with pytest.raises(UnsafeRemoteTarget, match="Only HTTPS"):
        asyncio.run(verify_public_https_target("http://gateway.example.com/mcp"))


def test_gateway_validator_rejects_private_resolution(monkeypatch):
    async def resolve_private(*_args, **_kwargs):
        return ("127.0.0.1",)

    monkeypatch.setattr("backend.app.assurance.security._resolve_public_addresses", resolve_private)
    with pytest.raises(UnsafeRemoteTarget, match="non-public"):
        asyncio.run(verify_public_https_target("https://gateway.example.com/mcp"))


def test_gateway_validator_requires_stable_approved_resolution(monkeypatch):
    async def resolve_public(*_args, **_kwargs):
        return ("8.8.8.8",)

    monkeypatch.setattr("backend.app.assurance.security._resolve_public_addresses", resolve_public)
    with pytest.raises(UnsafeRemoteTarget, match="does not match"):
        asyncio.run(verify_public_https_target("https://gateway.example.com/mcp", expected_addresses=["1.1.1.1"]))
