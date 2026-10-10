"""D3VONN Event OS fulfillment worker.

Consumes backend-only fulfillment_jobs created by atomic payment finalization.
Ticket QR tokens are derived from ticket UUIDs with HMAC and are never stored
in plaintext; only a SHA-256 digest is persisted. Digital access is materialized
as entitlements. Bundle jobs expand their canonical bundle_items directly.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Any, Mapping

from backend.ai_films.assembly_worker import SupabaseAssemblyClient

logger = logging.getLogger(__name__)


class EventOSFulfillmentError(RuntimeError):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _signing_secret(source: Mapping[str, str]) -> bytes:
    secret = str(source.get("EVENT_OS_TICKET_SIGNING_SECRET", "")).strip()
    if len(secret) < 32:
        raise EventOSFulfillmentError("EVENT_OS_TICKET_SIGNING_SECRET must be at least 32 characters")
    return secret.encode()


def build_qr_token(ticket_id: str, source: Mapping[str, str] | None = None) -> str:
    env = source or os.environ
    signature = hmac.new(_signing_secret(env), ticket_id.encode(), hashlib.sha256).hexdigest()
    return f"{ticket_id}.{signature}"


def qr_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def verify_qr_token(token: str, source: Mapping[str, str] | None = None) -> str | None:
    env = source or os.environ
    ticket_id, sep, signature = token.rpartition(".")
    if not sep or not ticket_id or not signature:
        return None
    expected = hmac.new(_signing_secret(env), ticket_id.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return None
    return ticket_id


async def _rows(
    db: SupabaseAssemblyClient,
    table: str,
    params: Mapping[str, str],
) -> list[dict[str, Any]]:
    return await db._request("GET", table, params=params)


async def _insert(
    db: SupabaseAssemblyClient,
    table: str,
    payload: Mapping[str, Any],
) -> dict[str, Any]:
    rows = await db._request("POST", table, payload=payload, representation=True)
    if not rows:
        raise EventOSFulfillmentError(f"{table} insert returned no row")
    return rows[0]


async def _patch(
    db: SupabaseAssemblyClient,
    table: str,
    row_id: str,
    payload: Mapping[str, Any],
) -> None:
    await db._request("PATCH", table, params={"id": f"eq.{row_id}"}, payload=payload)


async def claim_next_fulfillment_job(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await _rows(
        db,
        "fulfillment_jobs",
        {
            "status": "eq.queued",
            "available_at": f"lte.{_now()}",
            "select": "*",
            "order": "created_at.asc",
            "limit": "1",
        },
    )
    if not rows:
        return None
    job = rows[0]
    claimed = await db._request(
        "PATCH",
        "fulfillment_jobs",
        params={"id": f"eq.{job['id']}", "status": "eq.queued"},
        payload={
            "status": "running",
            "attempts": int(job.get("attempts") or 0) + 1,
            "started_at": _now(),
            "last_error": None,
            "updated_at": _now(),
        },
        representation=True,
    )
    return claimed[0] if claimed else None


async def _order(db: SupabaseAssemblyClient, order_id: str) -> dict[str, Any]:
    rows = await _rows(
        db,
        "orders",
        {"id": f"eq.{order_id}", "select": "*", "limit": "1"},
    )
    if not rows or rows[0].get("status") != "paid":
        raise EventOSFulfillmentError("fulfillment requires a paid order")
    return rows[0]


async def _order_item(db: SupabaseAssemblyClient, item_id: str) -> dict[str, Any]:
    rows = await _rows(
        db,
        "order_items",
        {"id": f"eq.{item_id}", "select": "*", "limit": "1"},
    )
    if not rows:
        raise EventOSFulfillmentError("order item not found")
    return rows[0]


async def _issue_tickets(
    db: SupabaseAssemblyClient,
    *,
    workspace_id: str,
    order: Mapping[str, Any],
    order_item_id: str,
    ticket_type_id: str,
    quantity: int,
    source: Mapping[str, str],
) -> list[dict[str, Any]]:
    ticket_type_rows = await _rows(
        db,
        "ticket_types",
        {"id": f"eq.{ticket_type_id}", "select": "id,event_id,name", "limit": "1"},
    )
    if not ticket_type_rows:
        raise EventOSFulfillmentError("ticket type not found")
    ticket_type = ticket_type_rows[0]

    existing = await _rows(
        db,
        "tickets",
        {
            "order_item_id": f"eq.{order_item_id}",
            "ticket_type_id": f"eq.{ticket_type_id}",
            "select": "*",
            "order": "issued_at.asc",
        },
    )
    issued = list(existing)
    while len(issued) < quantity:
        ticket_id = secrets.token_hex(16)
        # normalize to UUID-form without depending on uuid randomness hooks in tests
        ticket_id = f"{ticket_id[:8]}-{ticket_id[8:12]}-{ticket_id[12:16]}-{ticket_id[16:20]}-{ticket_id[20:32]}"
        qr = build_qr_token(ticket_id, source)
        code = f"HNF-{secrets.token_hex(4).upper()}"
        record = await _insert(
            db,
            "tickets",
            {
                "id": ticket_id,
                "workspace_id": workspace_id,
                "event_id": ticket_type["event_id"],
                "ticket_type_id": ticket_type_id,
                "order_id": order["id"],
                "order_item_id": order_item_id,
                "holder_user_id": order.get("purchaser_user_id"),
                "holder_email": order["purchaser_email"],
                "ticket_code": code,
                "qr_token_hash": qr_token_hash(qr),
                "status": "issued",
                "metadata": {
                    "qr_token_version": 1,
                    "ticket_type_name": ticket_type.get("name"),
                },
            },
        )
        record["qr_token"] = qr
        issued.append(record)
    return issued


def _entitlement_type(mode: str, metadata: Mapping[str, Any]) -> str:
    explicit = str(metadata.get("entitlement_type") or "").strip()
    if explicit in {"download", "stream", "replay", "vip", "backstage", "membership", "digital_asset"}:
        return explicit
    if mode == "download":
        return "download"
    if mode == "stream":
        return "stream"
    return "digital_asset"


async def _grant_product_entitlement(
    db: SupabaseAssemblyClient,
    *,
    workspace_id: str,
    order: Mapping[str, Any],
    order_item_id: str,
    product_id: str,
) -> dict[str, Any]:
    rows = await _rows(
        db,
        "products",
        {"id": f"eq.{product_id}", "select": "*", "limit": "1"},
    )
    if not rows:
        raise EventOSFulfillmentError("digital product not found")
    product = rows[0]
    metadata = dict(product.get("metadata") or {})
    key = str(metadata.get("entitlement_key") or f"product:{product_id}")
    existing = await _rows(
        db,
        "entitlements",
        {
            "order_item_id": f"eq.{order_item_id}",
            "entitlement_key": f"eq.{key}",
            "select": "*",
            "limit": "1",
        },
    )
    if existing:
        return existing[0]
    return await _insert(
        db,
        "entitlements",
        {
            "workspace_id": workspace_id,
            "user_id": order.get("purchaser_user_id"),
            "order_id": order["id"],
            "order_item_id": order_item_id,
            "event_id": order.get("event_id"),
            "entitlement_type": _entitlement_type(str(product.get("fulfillment_mode") or ""), metadata),
            "entitlement_key": key,
            "status": "active",
            "metadata": {
                "product_id": product_id,
                "product_name": product.get("name"),
                **({"asset_path": metadata["asset_path"]} if metadata.get("asset_path") else {}),
            },
        },
    )


async def _grant_named_entitlement(
    db: SupabaseAssemblyClient,
    *,
    workspace_id: str,
    order: Mapping[str, Any],
    order_item_id: str,
    key: str,
) -> dict[str, Any]:
    existing = await _rows(
        db,
        "entitlements",
        {
            "order_item_id": f"eq.{order_item_id}",
            "entitlement_key": f"eq.{key}",
            "select": "*",
            "limit": "1",
        },
    )
    if existing:
        return existing[0]
    kind = "stream" if "stream" in key else "replay" if "replay" in key else "digital_asset"
    return await _insert(
        db,
        "entitlements",
        {
            "workspace_id": workspace_id,
            "user_id": order.get("purchaser_user_id"),
            "order_id": order["id"],
            "order_item_id": order_item_id,
            "event_id": order.get("event_id"),
            "entitlement_type": kind,
            "entitlement_key": key,
            "status": "active",
            "metadata": {"source": "bundle"},
        },
    )


async def process_fulfillment_job(
    job: Mapping[str, Any],
    db: SupabaseAssemblyClient,
    source: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    env = source or os.environ
    order = await _order(db, str(job["order_id"]))
    workspace_id = str(job["workspace_id"])
    job_type = str(job["job_type"])
    payload = dict(job.get("payload") or {})
    result: dict[str, Any] = {"job_type": job_type}

    if job_type == "issue_ticket":
        item_id = str(job.get("order_item_id") or "")
        tickets = await _issue_tickets(
            db,
            workspace_id=workspace_id,
            order=order,
            order_item_id=item_id,
            ticket_type_id=str(payload["ticket_type_id"]),
            quantity=int(payload.get("quantity") or 1),
            source=env,
        )
        result["tickets"] = tickets

    elif job_type == "grant_entitlement":
        item_id = str(job.get("order_item_id") or "")
        item = await _order_item(db, item_id)
        product_id = str(item.get("product_id") or payload.get("product_id") or "")
        if not product_id:
            raise EventOSFulfillmentError("digital fulfillment requires product_id")
        result["entitlement"] = await _grant_product_entitlement(
            db,
            workspace_id=workspace_id,
            order=order,
            order_item_id=item_id,
            product_id=product_id,
        )

    elif job_type == "explode_bundle":
        item_id = str(job.get("order_item_id") or "")
        bundle_id = str(payload.get("bundle_id") or "")
        bundle_qty = int(payload.get("quantity") or 1)
        bundle_items = await _rows(
            db,
            "bundle_items",
            {"bundle_id": f"eq.{bundle_id}", "select": "*", "order": "created_at.asc"},
        )
        expanded: list[dict[str, Any]] = []
        for bundle_item in bundle_items:
            qty = int(bundle_item.get("quantity") or 1) * bundle_qty
            if bundle_item.get("ticket_type_id"):
                tickets = await _issue_tickets(
                    db,
                    workspace_id=workspace_id,
                    order=order,
                    order_item_id=item_id,
                    ticket_type_id=str(bundle_item["ticket_type_id"]),
                    quantity=qty,
                    source=env,
                )
                expanded.append({"type": "tickets", "count": len(tickets)})
            elif bundle_item.get("product_id"):
                product = await _rows(
                    db,
                    "products",
                    {"id": f"eq.{bundle_item['product_id']}", "select": "*", "limit": "1"},
                )
                if product and str(product[0].get("fulfillment_mode")) != "shipping":
                    ent = await _grant_product_entitlement(
                        db,
                        workspace_id=workspace_id,
                        order=order,
                        order_item_id=item_id,
                        product_id=str(bundle_item["product_id"]),
                    )
                    expanded.append({"type": "entitlement", "id": ent["id"]})
                else:
                    expanded.append({"type": "shipping", "product_id": bundle_item["product_id"], "quantity": qty})
            elif bundle_item.get("entitlement_key"):
                ent = await _grant_named_entitlement(
                    db,
                    workspace_id=workspace_id,
                    order=order,
                    order_item_id=item_id,
                    key=str(bundle_item["entitlement_key"]),
                )
                expanded.append({"type": "entitlement", "id": ent["id"]})
            elif bundle_item.get("variant_id"):
                expanded.append({"type": "shipping", "variant_id": bundle_item["variant_id"], "quantity": qty})
        result["expanded"] = expanded

    elif job_type in {"ship_merch", "notify_customer", "emit_hermes_event"}:
        # These remain durable handoff records. Provider-specific shipment,
        # messaging, and Hermes adapters can consume the persisted payload.
        result["handoff"] = payload

    else:
        raise EventOSFulfillmentError(f"unsupported fulfillment job type: {job_type}")

    await _patch(
        db,
        "fulfillment_jobs",
        str(job["id"]),
        {
            "status": "succeeded",
            "payload": {**payload, "result": result},
            "completed_at": _now(),
            "updated_at": _now(),
            "last_error": None,
        },
    )
    return result


async def run_event_os_fulfillment_worker(
    *,
    environ: Mapping[str, str] | None = None,
    once: bool = False,
) -> None:
    source = environ or os.environ
    if str(source.get("EVENT_OS_FULFILLMENT_ENABLED", "true")).strip().lower() in {"0", "false", "no", "off"}:
        logger.info("Event OS fulfillment worker is disabled.")
        return

    db = SupabaseAssemblyClient(source)
    poll = max(2.0, float(source.get("EVENT_OS_FULFILLMENT_POLL_SECONDS", "5") or 5))
    max_attempts = max(1, int(source.get("EVENT_OS_FULFILLMENT_MAX_ATTEMPTS", "5") or 5))

    while True:
        job = await claim_next_fulfillment_job(db)
        if not job:
            if once:
                return
            await asyncio.sleep(poll)
            continue
        try:
            await process_fulfillment_job(job, db, source)
        except Exception as exc:
            attempts = int(job.get("attempts") or 1)
            exhausted = attempts >= max_attempts
            logger.exception("Event OS fulfillment failed for job %s", job.get("id"))
            await _patch(
                db,
                "fulfillment_jobs",
                str(job["id"]),
                {
                    "status": "failed" if exhausted else "queued",
                    "available_at": _now(),
                    "last_error": f"{type(exc).__name__}: {exc}"[:2000],
                    "updated_at": _now(),
                },
            )
        if once:
            return
