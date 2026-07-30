from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from fastapi import HTTPException

from backend.app.routers import contact


VALID_REQUEST = contact.ContactRequest(
    name="Launch Certification",
    email="sender@example.com",
    subject="Contact delivery test",
    message="This is a valid contact delivery test message.",
)


def test_contact_fails_truthfully_when_delivery_is_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("CONTACT_TO_EMAIL", raising=False)
    monkeypatch.delenv("CONTACT_FROM_EMAIL", raising=False)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(contact.send_contact_message(VALID_REQUEST))

    assert exc_info.value.status_code == 503
    assert "temporarily unavailable" in str(exc_info.value.detail)
    assert "hello@d3vonn.io" in str(exc_info.value.detail)


def test_honeypot_is_accepted_without_external_delivery(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    request = VALID_REQUEST.model_copy(update={"website": "https://spam.example"})

    result = asyncio.run(contact.send_contact_message(request))

    assert result.status == "accepted"


def test_contact_uses_server_side_resend_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    class FakeResponse:
        status_code = 202
        text = '{"id":"email_123"}'

    class FakeClient:
        def __init__(self, *, timeout: float) -> None:
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def post(self, url: str, *, headers: dict[str, str], json: dict[str, object]):
            captured.update({"url": url, "headers": headers, "json": json})
            return FakeResponse()

    monkeypatch.setenv("RESEND_API_KEY", "server-secret")
    monkeypatch.setenv("CONTACT_TO_EMAIL", "hello@d3vonn.io")
    monkeypatch.setenv("CONTACT_FROM_EMAIL", "D3VONN.IO <hello@d3vonn.io>")
    monkeypatch.setattr(contact.httpx, "AsyncClient", FakeClient)

    result = asyncio.run(contact.send_contact_message(VALID_REQUEST))

    assert result.status == "sent"
    assert captured["url"] == "https://api.resend.com/emails"
    assert captured["headers"] == {
        "Authorization": "Bearer server-secret",
        "Content-Type": "application/json",
    }
    request_json = captured["json"]
    assert isinstance(request_json, dict)
    assert request_json["from"] == "D3VONN.IO <hello@d3vonn.io>"
    assert request_json["to"] == ["hello@d3vonn.io"]
    assert request_json["reply_to"] == "sender@example.com"


def test_frontend_no_longer_claims_success_without_network_delivery() -> None:
    source = Path("src/pages/Contact.tsx").read_text(encoding="utf-8")
    assert "fetch(`${env.apiUrl.replace" in source
    assert "/api/contact" in source
    assert "Message not delivered" in source
    assert "hello@d3vonn.io" in source
    assert "info@d3vonn.io" not in source
    assert "123 AI Boulevard" not in source
    assert "+1 (555) 123-4567" not in source
