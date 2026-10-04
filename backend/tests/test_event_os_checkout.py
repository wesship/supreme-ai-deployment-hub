import asyncio
import hashlib
import hmac
import json
import time

from starlette.requests import Request

from backend.app.routers import event_os


WORKSPACE_ID = "b7c0ccda-88d3-48cf-ab91-811fd73a3d79"
EVENT_ID = "d25e523c-5829-4508-aefd-c61794967371"
TICKET_TYPE_ID = "a24c8194-10f8-41a4-9248-3fbc48ec23c0"
ORDER_ID = "c24c8194-10f8-41a4-9248-3fbc48ec23c0"
LEDGER_ID = "e24c8194-10f8-41a4-9248-3fbc48ec23c0"


def _request(path: str = "/api/event-os/checkout", body: bytes = b"", headers=None) -> Request:
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    raw_headers = [
        (key.lower().encode(), value.encode())
        for key, value in (headers or {}).items()
    ]
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": path,
            "headers": raw_headers,
            "client": ("127.0.0.1", 50000),
            "scheme": "https",
            "server": ("api.d3vonn.io", 443),
        },
        receive,
    )


def test_checkout_uses_server_prices_and_reserves_before_stripe(monkeypatch):
    calls = []
    order_items = []

    async def fake_service(method, table, *, params=None, json_body=None, prefer="return=representation"):
        calls.append((method, table, params, json_body, prefer))
        if method == "GET" and table == "events":
            return [{"id": EVENT_ID, "workspace_id": WORKSPACE_ID, "status": "on_sale", "visibility": "public"}]
        if method == "GET" and table == "ticket_types":
            return [{
                "id": TICKET_TYPE_ID,
                "workspace_id": WORKSPACE_ID,
                "event_id": EVENT_ID,
                "name": "General Admission",
                "price_cents": 2500,
                "currency": "USD",
                "is_active": True,
            }]
        if method == "POST" and table == "orders":
            assert json_body["subtotal_cents"] == 5000
            assert json_body["total_cents"] == 5000
            return [{"id": ORDER_ID, **json_body}]
        if method == "POST" and table == "order_items":
            order_items.append(json_body)
            return [{"id": "f24c8194-10f8-41a4-9248-3fbc48ec23c0", **json_body}]
        if method == "PATCH" and table == "orders":
            return None
        raise AssertionError((method, table, params, json_body))

    async def fake_rpc(name, payload):
        calls.append(("RPC", name, payload))
        assert name == "event_os_reserve_order_inventory"
        assert payload["p_order_id"] == ORDER_ID
        return {"order_id": ORDER_ID, "status": "reserved", "expires_at": "2026-09-27T02:30:00Z"}

    async def fake_stripe(**kwargs):
        calls.append(("STRIPE", kwargs))
        assert kwargs["items"][0]["unit_price_cents"] == 2500
        assert kwargs["items"][0]["quantity"] == 2
        return {"id": "cs_test_123", "url": "https://checkout.stripe.com/c/pay/test"}

    monkeypatch.setattr(event_os, "_service_request", fake_service)
    monkeypatch.setattr(event_os, "_rpc", fake_rpc)
    monkeypatch.setattr(event_os, "_create_stripe_session", fake_stripe)
    monkeypatch.setenv("EVENT_OS_CHECKOUT_RETURN_HOSTS", "hnfportal.one")

    body = event_os.CheckoutRequest(
        workspace_id=WORKSPACE_ID,
        event_id=EVENT_ID,
        purchaser_email="fan@example.com",
        items=[{"item_type": "ticket_type", "item_id": TICKET_TYPE_ID, "quantity": 2}],
        success_url="https://hnfportal.one/events/success",
        cancel_url="https://hnfportal.one/events/cancel",
    )

    result = asyncio.run(event_os.create_checkout(body, _request()))

    assert result.order_id == ORDER_ID
    assert result.checkout_session_id == "cs_test_123"
    assert order_items[0]["unit_price_cents"] == 2500
    reserve_index = next(i for i, call in enumerate(calls) if call[0] == "RPC")
    stripe_index = next(i for i, call in enumerate(calls) if call[0] == "STRIPE")
    assert reserve_index < stripe_index


def test_stripe_signature_verification(monkeypatch):
    secret = "whsec_test"
    timestamp = 1770000000
    body = b'{"id":"evt_test"}'
    signature = hmac.new(
        secret.encode(),
        str(timestamp).encode() + b"." + body,
        hashlib.sha256,
    ).hexdigest()

    monkeypatch.setattr(event_os.time, "time", lambda: timestamp)
    event_os._verify_stripe_signature(body, f"t={timestamp},v1={signature}", secret)


def test_paid_stripe_webhook_finalizes_once(monkeypatch):
    secret = "whsec_test"
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", secret)

    event = {
        "id": "evt_paid_123",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_123",
                "payment_status": "paid",
                "payment_intent": "pi_test_123",
                "amount_total": 5000,
                "currency": "usd",
                "metadata": {
                    "order_id": ORDER_ID,
                    "workspace_id": WORKSPACE_ID,
                },
            }
        },
    }
    body = json.dumps(event, separators=(",", ":")).encode()
    timestamp = int(time.time())
    signature = hmac.new(
        secret.encode(),
        str(timestamp).encode() + b"." + body,
        hashlib.sha256,
    ).hexdigest()

    patches = []

    async def fake_service(method, table, *, params=None, json_body=None, prefer="return=representation"):
        if method == "POST" and table == "payment_events":
            assert json_body["signature_valid"] is True
            return [{"id": LEDGER_ID, **json_body}]
        if method == "PATCH" and table == "payment_events":
            patches.append(json_body)
            return None
        raise AssertionError((method, table, params, json_body))

    async def fake_rpc(name, payload):
        assert name == "event_os_finalize_order_payment"
        assert payload["p_order_id"] == ORDER_ID
        assert payload["p_amount_cents"] == 5000
        assert payload["p_currency"] == "USD"
        return {"order_id": ORDER_ID, "status": "paid", "idempotent": False}

    monkeypatch.setattr(event_os, "_service_request", fake_service)
    monkeypatch.setattr(event_os, "_rpc", fake_rpc)

    request = _request(
        "/api/event-os/webhooks/stripe",
        body,
        {"Stripe-Signature": f"t={timestamp},v1={signature}"},
    )
    result = asyncio.run(event_os.stripe_webhook(request))

    assert result["accepted"] is True
    assert result["result"]["status"] == "paid"
    assert patches and "processed_at" in patches[-1]


def test_stripe_session_sends_an_encoded_async_request(monkeypatch):
    import httpx
    from urllib.parse import parse_qs

    monkeypatch.setenv("STRIPE_SECRET_KEY", "test-local-stripe-key")
    captured = []

    def handle(request):
        captured.append(request)
        return httpx.Response(200, json={"id": "cs_local", "url": "https://checkout.stripe.com/local"})

    original_client = httpx.AsyncClient
    monkeypatch.setattr(event_os.httpx, "AsyncClient",
                        lambda **kwargs: original_client(transport=httpx.MockTransport(handle), **kwargs))
    result = asyncio.run(event_os._create_stripe_session(
        order_id=ORDER_ID, workspace_id=WORKSPACE_ID, purchaser_email="buyer+local@example.com",
        currency="USD", items=[{"quantity": 2, "unit_price_cents": 1500, "title": "Music & film"}],
        success_url="https://example.com/success", cancel_url="https://example.com/cancel"))
    assert result["id"] == "cs_local"
    request = captured[0]
    fields = parse_qs(request.content.decode())
    assert request.headers["content-type"] == "application/x-www-form-urlencoded"
    assert request.headers["idempotency-key"] == f"event-os-checkout:{ORDER_ID}"
    assert fields["customer_email"] == ["buyer+local@example.com"]
    assert fields["line_items[0][price_data][product_data][name]"] == ["Music & film"]
    assert fields["line_items[0][price_data][unit_amount]"] == ["1500"]
    assert fields["line_items[0][quantity]"] == ["2"]
    assert fields["metadata[workspace_id]"] == [WORKSPACE_ID]
