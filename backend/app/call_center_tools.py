"""Governed provider adapters for D3VONN.IO call-center tools.

The realtime voice model never receives raw provider credentials. These helpers
perform narrowly scoped reads/writes and return compact, voice-safe results.
"""
from __future__ import annotations

import os
from typing import Any

import httpx

_PROVIDER_TIMEOUT = 10.0


def _env(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value and not value.lower().startswith(("paste_", "change_me", "your_", "placeholder")):
            return value
    return ""


def _hubspot_headers() -> dict[str, str]:
    token = _env("HUBSPOT_ACCESS_TOKEN", "HUBSPOT_PRIVATE_APP_TOKEN")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"} if token else {}


async def lookup_customer(parameters: dict[str, Any]) -> dict[str, Any]:
    """Find one HubSpot contact by email or phone. Read-only."""
    headers = _hubspot_headers()
    if not headers:
        return {"status": "unavailable", "provider": "hubspot", "reason": "not_configured"}

    email = str(parameters.get("email") or "").strip()
    phone = str(parameters.get("phone") or "").strip()
    if not email and not phone:
        return {"status": "rejected", "reason": "email_or_phone_required"}

    property_name, value = ("email", email) if email else ("phone", phone)
    body = {
        "filterGroups": [{"filters": [{"propertyName": property_name, "operator": "EQ", "value": value}]}],
        "properties": ["firstname", "lastname", "email", "phone", "company", "lifecyclestage"],
        "limit": 1,
    }
    try:
        async with httpx.AsyncClient(timeout=_PROVIDER_TIMEOUT) as client:
            response = await client.post(
                "https://api.hubapi.com/crm/v3/objects/contacts/search",
                headers=headers,
                json=body,
            )
        response.raise_for_status()
        results = response.json().get("results", [])
    except (httpx.HTTPError, ValueError):
        return {"status": "unavailable", "provider": "hubspot", "reason": "provider_error"}

    if not results:
        return {"status": "not_found", "provider": "hubspot"}
    contact = results[0]
    return {
        "status": "ok",
        "provider": "hubspot",
        "customer": {"id": contact.get("id"), **(contact.get("properties") or {})},
    }


async def get_customer_context(parameters: dict[str, Any]) -> dict[str, Any]:
    """Return a minimal customer context suitable for realtime voice."""
    result = await lookup_customer(parameters)
    if result.get("status") != "ok":
        return result
    customer = result["customer"]
    return {
        "status": "ok",
        "provider": "hubspot",
        "context": {
            "customer_id": customer.get("id"),
            "name": " ".join(filter(None, [customer.get("firstname"), customer.get("lastname")])).strip(),
            "company": customer.get("company"),
            "lifecycle_stage": customer.get("lifecyclestage"),
            "email": customer.get("email"),
            "phone": customer.get("phone"),
        },
    }


def _calendar_headers() -> dict[str, str]:
    token = _env("GOOGLE_CALENDAR_ACCESS_TOKEN")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"} if token else {}


async def get_available_slots(parameters: dict[str, Any]) -> dict[str, Any]:
    """Read Google Calendar free/busy for one configured calendar."""
    headers = _calendar_headers()
    calendar_id = _env("GOOGLE_CALENDAR_ID") or "primary"
    if not headers:
        return {"status": "unavailable", "provider": "google_calendar", "reason": "not_configured"}

    time_min = str(parameters.get("time_min") or "").strip()
    time_max = str(parameters.get("time_max") or "").strip()
    if not time_min or not time_max:
        return {"status": "rejected", "reason": "time_min_and_time_max_required"}

    body = {"timeMin": time_min, "timeMax": time_max, "items": [{"id": calendar_id}]}
    try:
        async with httpx.AsyncClient(timeout=_PROVIDER_TIMEOUT) as client:
            response = await client.post(
                "https://www.googleapis.com/calendar/v3/freeBusy",
                headers=headers,
                json=body,
            )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError):
        return {"status": "unavailable", "provider": "google_calendar", "reason": "provider_error"}

    busy = ((payload.get("calendars") or {}).get(calendar_id) or {}).get("busy", [])
    return {
        "status": "ok",
        "provider": "google_calendar",
        "window": {"time_min": time_min, "time_max": time_max},
        "busy": busy,
    }


async def book_appointment(parameters: dict[str, Any]) -> dict[str, Any]:
    """Create a Google Calendar event only after explicit caller confirmation."""
    headers = _calendar_headers()
    calendar_id = _env("GOOGLE_CALENDAR_ID") or "primary"
    if not headers:
        return {"status": "unavailable", "provider": "google_calendar", "reason": "not_configured"}
    if parameters.get("confirmed") is not True:
        return {"status": "rejected", "reason": "explicit_confirmation_required"}

    start = str(parameters.get("start") or "").strip()
    end = str(parameters.get("end") or "").strip()
    summary = str(parameters.get("summary") or "D3VONN appointment").strip()[:240]
    if not start or not end:
        return {"status": "rejected", "reason": "start_and_end_required"}

    event: dict[str, Any] = {
        "summary": summary,
        "start": {"dateTime": start},
        "end": {"dateTime": end},
    }
    attendee_email = str(parameters.get("attendee_email") or "").strip()
    if attendee_email:
        event["attendees"] = [{"email": attendee_email}]

    try:
        async with httpx.AsyncClient(timeout=_PROVIDER_TIMEOUT) as client:
            response = await client.post(
                f"https://www.googleapis.com/calendar/v3/calendars/{httpx.URL(calendar_id).raw_path.decode()}/events",
                headers=headers,
                params={"sendUpdates": "all" if attendee_email else "none"},
                json=event,
            )
        response.raise_for_status()
        created = response.json()
    except (httpx.HTTPError, ValueError):
        return {"status": "unavailable", "provider": "google_calendar", "reason": "provider_error"}

    return {
        "status": "booked",
        "provider": "google_calendar",
        "event": {
            "id": created.get("id"),
            "html_link": created.get("htmlLink"),
            "start": created.get("start"),
            "end": created.get("end"),
            "summary": created.get("summary"),
        },
    }


TOOL_HANDLERS = {
    "lookup_customer": lookup_customer,
    "get_customer_context": get_customer_context,
    "get_available_slots": get_available_slots,
    "book_appointment": book_appointment,
}
