"""D3VONN Event OS checkout and Stripe webhook boundary.

Public checkout is intentionally server-authoritative:
- the browser supplies resource identifiers + quantities, never prices;
- canonical prices and sale state are re-read from Supabase;
- inventory is reserved through a service-role-only RPC;
- Stripe metadata carries only internal identifiers;
- payment success is accepted only from a verified Stripe webhook.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import time
from collections import defaultdict, deque
from typing import Any, Literal
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field, HttpUrl, field_validator

router = APIRouter(prefix="/event-os", tags=["event-os"])

_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
_ALLOWED_TABLES = frozenset(
    {
        "events",
        "ticket_types",
        "products",
        "product_variants",
        "bundles",
        "orders",
        "order_items",
        "payment_events",
    }
)
_ALLOWED_RPCS = frozenset(
    {
        "event_os_reserve_order_inventory",
        "event_os_finalize_order_payment",
        "event_os_release_order_inventory",
    }
)
_checkout_windows: dict[str, deque[float]] = defaultdict(deque)


class CheckoutLine(BaseModel):
    item_type: Literal["ticket_type", "product", "variant", "bundle"]
    item_id: str = Field(pattern=_UUID_RE.pattern)
    quantity: int = Field(default=1, ge=1, le=20)


class CheckoutRequest(BaseModel):
    workspace_id: str = Field(pattern=_UUID_RE.pattern)
    event_id: str | None = Field(default=None, pattern=_UUID_RE.pattern)
    purchaser_email: EmailStr
    items: list[CheckoutLine] = Field(min_length=1, max_length=20)
    success_url: HttpUrl
    cancel_url: HttpUrl


class CheckoutResponse(BaseModel):
    order_id: str
    checkout_session_id: str
    checkout_url: str
    reservation_expires_at: str | None = None


def _supabase_config() -> tuple[str, str]:
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base_url or not service_key:
        raise HTTPException(status_code=503, detail="Event OS persistence is not configured")
    parsed = urlparse(base_url)
    if parsed.scheme != "https" or not parsed.hostname or not (
        parsed.hostname.endswith(".supabase.co") or parsed.hostname.endswith(".supabase.in")
    ):
        raise HTTPException(status_code=503, detail="Invalid Supabase backend URL")
    return base_url, service_key


def _service_headers(prefer: str = "return=representation") -> dict[str, str]:
    _, key = _supabase_config()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


async def _service_request(
    method: str,
    table: str,
    *,
    params: dict[str, str] | None = None,
    json_body: Any = None,
    prefer: str = "return=representation",
) -> Any:
    if table not in _ALLOWED_TABLES:
        raise HTTPException(status_code=500, detail="Event OS table is not allow-listed")
    base_url, _ = _supabase_config()
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.request(
                method,
                f"{base_url}/rest/v1/{table}",
                headers=_service_headers(prefer),
                params=params,
                json=json_body,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Event OS persistence unavailable") from exc
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Event OS persistence failed ({response.status_code})",
        )
    return response.json() if response.content else None


async def _rpc(name: str, payload: dict[str, Any]) -> Any:
    if name not in _ALLOWED_RPCS:
        raise HTTPException(status_code=500, detail="Event OS RPC is not allow-listed")
    base_url, _ = _supabase_config()
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{base_url}/rest/v1/rpc/{name}",
                headers=_service_headers(),
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Event OS transaction service unavailable") from exc
    if response.status_code >= 400:
        detail = "Event OS transaction failed"
        try:
            body = response.json()
            code = str(body.get("message") or "")
            if "sold_out" in code:
                raise HTTPException(status_code=409, detail="Selected inventory is no longer available")
            if "reservation_expired" in code:
                raise HTTPException(status_code=409, detail="Checkout reservation expired")
        except (ValueError, AttributeError):
            pass
        raise HTTPException(status_code=502, detail=detail)
    return response.json() if response.content else None


def _validate_return_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Checkout return URLs must use HTTPS")
    allowed = {
        item.strip().lower()
        for item in os.getenv(
            "EVENT_OS_CHECKOUT_RETURN_HOSTS",
            "hnfportal.one,www.hnfportal.one,d3vonn.io,www.d3vonn.io",
        ).split(",")
        if item.strip()
    }
    if parsed.hostname.lower() not in allowed:
        raise HTTPException(status_code=400, detail="Checkout return URL host is not allowed")
    return value


def _check_checkout_rate_limit(request: Request, email: str) -> None:
    limit = max(1, int(os.getenv("EVENT_OS_CHECKOUT_RATE_LIMIT_PER_MINUTE", "10")))
    host = request.client.host if request.client else "unknown"
    key = hashlib.sha256(f"{host}|{email.lower()}".encode()).hexdigest()
    now = time.monotonic()
    window = _checkout_windows[key]
    while window and now - window[0] >= 60:
        window.popleft()
    if len(window) >= limit:
        raise HTTPException(status_code=429, detail="Checkout rate limit exceeded")
    window.append(now)


async def _one(table: str, params: dict[str, str]) -> dict[str, Any]:
    rows = await _service_request("GET", table, params={**params, "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Checkout item not found")
    return rows[0]


async def _canonical_line(
    workspace_id: str,
    event_id: str | None,
    line: CheckoutLine,
) -> dict[str, Any]:
    common = {"workspace_id": f"eq.{workspace_id}", "id": f"eq.{line.item_id}"}

    if line.item_type == "ticket_type":
        row = await _one("ticket_types", {**common, "is_active": "eq.true", "select": "*"})
        if event_id and row.get("event_id") != event_id:
            raise HTTPException(status_code=400, detail="Ticket type does not belong to this event")
        return {
            "item_type": "ticket_type",
            "ticket_type_id": row["id"],
            "title": row["name"],
            "unit_price_cents": int(row["price_cents"]),
            "currency": str(row.get("currency") or "USD").upper(),
            "quantity": line.quantity,
        }

    if line.item_type == "product":
        row = await _one("products", {**common, "status": "eq.active", "select": "*"})
        return {
            "item_type": "product",
            "product_id": row["id"],
            "title": row["name"],
            "unit_price_cents": int(row["price_cents"]),
            "currency": str(row.get("currency") or "USD").upper(),
            "quantity": line.quantity,
        }

    if line.item_type == "variant":
        variant = await _one("product_variants", {**common, "is_active": "eq.true", "select": "*"})
        product = await _one(
            "products",
            {
                "workspace_id": f"eq.{workspace_id}",
                "id": f"eq.{variant['product_id']}",
                "status": "eq.active",
                "select": "*",
            },
        )
        price = variant.get("price_cents")
        if price is None:
            price = product["price_cents"]
        return {
            "item_type": "variant",
            "product_id": product["id"],
            "variant_id": variant["id"],
            "title": f"{product['name']} — {variant['title']}",
            "unit_price_cents": int(price),
            "currency": str(product.get("currency") or "USD").upper(),
            "quantity": line.quantity,
        }

    bundle = await _one("bundles", {**common, "status": "eq.active", "select": "*"})
    if event_id and bundle.get("event_id") and bundle.get("event_id") != event_id:
        raise HTTPException(status_code=400, detail="Bundle does not belong to this event")
    return {
        "item_type": "bundle",
        "bundle_id": bundle["id"],
        "title": bundle["name"],
        "unit_price_cents": int(bundle["price_cents"]),
        "currency": str(bundle.get("currency") or "USD").upper(),
        "quantity": line.quantity,
    }


async def _create_stripe_session(
    *,
    order_id: str,
    workspace_id: str,
    purchaser_email: str,
    currency: str,
    items: list[dict[str, Any]],
    success_url: str,
    cancel_url: str,
) -> dict[str, Any]:
    secret = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="Stripe checkout is not configured")

    form: list[tuple[str, str]] = [
        ("mode", "payment"),
        ("customer_email", purchaser_email),
        ("success_url", success_url),
        ("cancel_url", cancel_url),
        ("metadata[order_id]", order_id),
        ("metadata[workspace_id]", workspace_id),
        ("payment_intent_data[metadata][order_id]", order_id),
        ("payment_intent_data[metadata][workspace_id]", workspace_id),
    ]
    for index, item in enumerate(items):
        form.extend(
            [
                (f"line_items[{index}][quantity]", str(item["quantity"])),
                (
                    f"line_items[{index}][price_data][currency]",
                    currency.lower(),
                ),
                (
                    f"line_items[{index}][price_data][unit_amount]",
                    str(item["unit_price_cents"]),
                ),
                (
                    f"line_items[{index}][price_data][product_data][name]",
                    str(item["title"])[:127],
                ),
            ]
        )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.stripe.com/v1/checkout/sessions",
                headers={
                    "Authorization": f"Bearer {secret}",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Idempotency-Key": f"event-os-checkout:{order_id}",
                },
                data=form,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Stripe checkout unavailable") from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Stripe checkout session creation failed")
    payload = response.json()
    if not payload.get("id") or not payload.get("url"):
        raise HTTPException(status_code=502, detail="Stripe returned an incomplete checkout session")
    return payload


def _verify_stripe_signature(body: bytes, header: str, secret: str, tolerance: int = 300) -> None:
    timestamp: int | None = None
    signatures: list[str] = []
    for part in header.split(","):
        key, _, value = part.strip().partition("=")
        if key == "t":
            try:
                timestamp = int(value)
            except ValueError:
                timestamp = None
        elif key == "v1" and value:
            signatures.append(value)

    if timestamp is None or not signatures:
        raise HTTPException(status_code=400, detail="Malformed Stripe signature")
    if abs(int(time.time()) - timestamp) > tolerance:
        raise HTTPException(status_code=400, detail="Expired Stripe signature")

    signed = str(timestamp).encode() + b"." + body
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, candidate) for candidate in signatures):
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")


@router.post("/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
async def create_checkout(body: CheckoutRequest, request: Request) -> CheckoutResponse:
    _check_checkout_rate_limit(request, str(body.purchaser_email))
    workspace_id = body.workspace_id
    event_id = body.event_id

    if event_id:
        await _one(
            "events",
            {
                "id": f"eq.{event_id}",
                "workspace_id": f"eq.{workspace_id}",
                "visibility": "eq.public",
                "status": "in.(on_sale,live)",
                "select": "id,workspace_id,status,visibility",
            },
        )

    canonical = [await _canonical_line(workspace_id, event_id, item) for item in body.items]
    currencies = {item["currency"] for item in canonical}
    if len(currencies) != 1:
        raise HTTPException(status_code=400, detail="All checkout items must use the same currency")
    currency = currencies.pop()
    subtotal = sum(item["unit_price_cents"] * item["quantity"] for item in canonical)

    order_rows = await _service_request(
        "POST",
        "orders",
        json_body={
            "workspace_id": workspace_id,
            "event_id": event_id,
            "purchaser_email": str(body.purchaser_email).lower(),
            "status": "pending",
            "currency": currency,
            "subtotal_cents": subtotal,
            "total_cents": subtotal,
        },
    )
    if not order_rows:
        raise HTTPException(status_code=502, detail="Order creation failed")
    order = order_rows[0]

    order_items: list[dict[str, Any]] = []
    for item in canonical:
        record = {
            "workspace_id": workspace_id,
            "order_id": order["id"],
            "item_type": item["item_type"],
            "product_id": item.get("product_id"),
            "variant_id": item.get("variant_id"),
            "ticket_type_id": item.get("ticket_type_id"),
            "bundle_id": item.get("bundle_id"),
            "title_snapshot": item["title"],
            "unit_price_cents": item["unit_price_cents"],
            "quantity": item["quantity"],
            "line_total_cents": item["unit_price_cents"] * item["quantity"],
        }
        rows = await _service_request("POST", "order_items", json_body=record)
        order_items.append((rows or [record])[0])

    reservation = await _rpc(
        "event_os_reserve_order_inventory",
        {"p_order_id": order["id"], "p_hold_minutes": 30},
    )

    try:
        session = await _create_stripe_session(
            order_id=order["id"],
            workspace_id=workspace_id,
            purchaser_email=str(body.purchaser_email).lower(),
            currency=currency,
            items=canonical,
            success_url=_validate_return_url(str(body.success_url)),
            cancel_url=_validate_return_url(str(body.cancel_url)),
        )
    except HTTPException:
        await _rpc(
            "event_os_release_order_inventory",
            {"p_order_id": order["id"], "p_order_status": "failed"},
        )
        raise

    await _service_request(
        "PATCH",
        "orders",
        params={"id": f"eq.{order['id']}"},
        json_body={"external_checkout_id": session["id"]},
        prefer="return=minimal",
    )

    expires_at = reservation.get("expires_at") if isinstance(reservation, dict) else None
    return CheckoutResponse(
        order_id=order["id"],
        checkout_session_id=session["id"],
        checkout_url=session["url"],
        reservation_expires_at=expires_at,
    )


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request) -> dict[str, Any]:
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="Stripe webhook verification is not configured")

    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    _verify_stripe_signature(body, signature, secret)

    try:
        event = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook JSON") from exc

    event_type = str(event.get("type") or "")
    if event_type not in {
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired",
    }:
        return {"accepted": True, "ignored": True, "event_type": event_type}

    event_id = str(event.get("id") or "")
    obj = ((event.get("data") or {}).get("object") or {})
    metadata = obj.get("metadata") or {}
    order_id = str(metadata.get("order_id") or "")
    workspace_id = str(metadata.get("workspace_id") or "")
    if not _UUID_RE.match(order_id) or not _UUID_RE.match(workspace_id):
        raise HTTPException(status_code=400, detail="Stripe event is missing Event OS metadata")

    payload_hash = hashlib.sha256(body).hexdigest()
    ledger = await _service_request(
        "POST",
        "payment_events",
        params={"on_conflict": "provider,provider_event_id"},
        json_body={
            "workspace_id": workspace_id,
            "order_id": order_id,
            "provider": "stripe",
            "provider_event_id": event_id,
            "event_type": event_type,
            "signature_valid": True,
            "amount_cents": obj.get("amount_total"),
            "currency": str(obj.get("currency") or "").upper() or None,
            "payload_sha256": payload_hash,
        },
        prefer="resolution=ignore-duplicates,return=representation",
    )
    if not ledger:
        return {"accepted": True, "duplicate": True, "event_id": event_id}

    ledger_id = ledger[0]["id"]
    try:
        if event_type in {"checkout.session.expired", "checkout.session.async_payment_failed"}:
            result = await _rpc(
                "event_os_release_order_inventory",
                {
                    "p_order_id": order_id,
                    "p_order_status": "failed" if event_type.endswith("failed") else "cancelled",
                },
            )
        else:
            if str(obj.get("payment_status") or "") != "paid":
                await _service_request(
                    "PATCH",
                    "payment_events",
                    params={"id": f"eq.{ledger_id}"},
                    json_body={"processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
                    prefer="return=minimal",
                )
                return {"accepted": True, "paid": False, "event_id": event_id}

            amount_total = obj.get("amount_total")
            currency = str(obj.get("currency") or "").upper()
            payment_intent = str(obj.get("payment_intent") or "")
            if not isinstance(amount_total, int) or not currency or not payment_intent:
                raise HTTPException(status_code=400, detail="Incomplete Stripe payment payload")

            result = await _rpc(
                "event_os_finalize_order_payment",
                {
                    "p_order_id": order_id,
                    "p_provider": "stripe",
                    "p_provider_payment_id": payment_intent,
                    "p_provider_checkout_id": str(obj.get("id") or ""),
                    "p_amount_cents": amount_total,
                    "p_currency": currency,
                },
            )

        await _service_request(
            "PATCH",
            "payment_events",
            params={"id": f"eq.{ledger_id}"},
            json_body={"processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
            prefer="return=minimal",
        )
        return {"accepted": True, "event_id": event_id, "result": result}
    except HTTPException as exc:
        await _service_request(
            "PATCH",
            "payment_events",
            params={"id": f"eq.{ledger_id}"},
            json_body={"processing_error": str(exc.detail)[:1000]},
            prefer="return=minimal",
        )
        raise
