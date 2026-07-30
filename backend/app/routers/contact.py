"""Public D3VONN.IO contact-form delivery through the configured Resend account."""
from __future__ import annotations

import html
import logging
import os
import re

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/contact", tags=["contact"])

_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_PUBLIC_CONTACT_EMAIL = "hello@d3vonn.io"


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    subject: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=10, max_length=5000)
    website: str = Field(default="", max_length=200, description="Spam honeypot")

    @field_validator("name", "subject", "message")
    @classmethod
    def strip_text(cls, value: str) -> str:
        clean = value.strip()
        if not clean:
            raise ValueError("value cannot be blank")
        return clean

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        clean = value.strip().lower()
        if not _EMAIL_PATTERN.fullmatch(clean):
            raise ValueError("invalid email address")
        return clean


class ContactResponse(BaseModel):
    status: str
    message: str


@router.post("", response_model=ContactResponse, status_code=status.HTTP_202_ACCEPTED)
async def send_contact_message(payload: ContactRequest) -> ContactResponse:
    """Deliver a validated support inquiry without exposing mail credentials."""
    # Bots that populate the hidden field receive a neutral accepted response,
    # while no external request or owner notification is generated.
    if payload.website.strip():
        return ContactResponse(status="accepted", message="Your message was received.")

    api_key = os.getenv("RESEND_API_KEY", "").strip()
    recipient = os.getenv("CONTACT_TO_EMAIL", "").strip()
    sender = os.getenv("CONTACT_FROM_EMAIL", "").strip()
    if not api_key or not recipient or not sender:
        logger.error("Contact delivery is not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Contact delivery is temporarily unavailable. Please email {_PUBLIC_CONTACT_EMAIL}.",
        )

    safe_name = html.escape(payload.name)
    safe_email = html.escape(payload.email)
    safe_subject = html.escape(payload.subject)
    safe_message = html.escape(payload.message).replace("\n", "<br>")

    request_body = {
        "from": sender,
        "to": [recipient],
        "reply_to": payload.email,
        "subject": f"[D3VONN.IO Contact] {payload.subject}",
        "text": (
            f"Name: {payload.name}\n"
            f"Email: {payload.email}\n"
            f"Subject: {payload.subject}\n\n"
            f"{payload.message}"
        ),
        "html": (
            "<h2>D3VONN.IO contact inquiry</h2>"
            f"<p><strong>Name:</strong> {safe_name}</p>"
            f"<p><strong>Email:</strong> {safe_email}</p>"
            f"<p><strong>Subject:</strong> {safe_subject}</p>"
            f"<p>{safe_message}</p>"
        ),
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            )
    except httpx.HTTPError as exc:
        logger.exception("Contact delivery request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Your message could not be delivered. Please email {_PUBLIC_CONTACT_EMAIL}.",
        ) from exc

    if response.status_code >= 400:
        logger.error(
            "Contact delivery provider rejected request status=%s body=%s",
            response.status_code,
            response.text[:300],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Your message could not be delivered. Please email {_PUBLIC_CONTACT_EMAIL}.",
        )

    return ContactResponse(status="sent", message="Your message was delivered successfully.")
