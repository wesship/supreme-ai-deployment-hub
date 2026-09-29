from decimal import Decimal

import pytest

from backend.moneyhub.providers.stripe import (
    StripeNormalizationError,
    normalize_verified_checkout_event,
)


def _event(**overrides):
    event = {
        "id": "evt_123",
        "type": "checkout.session.completed",
        "created": 1780000000,
        "data": {
            "object": {
                "id": "cs_123",
                "payment_intent": "pi_123",
                "payment_status": "paid",
                "amount_total": 12500,
                "currency": "usd",
                "created": 1780000000,
                "metadata": {
                    "order_id": "11111111-1111-1111-1111-111111111111",
                    "workspace_id": "22222222-2222-2222-2222-222222222222",
                },
            }
        },
    }
    event.update(overrides)
    return event


def test_verified_stripe_checkout_normalizes_to_provider_batch():
    batch = normalize_verified_checkout_event(_event())
    assert batch.provider == "stripe"
    assert batch.source_kind == "payment"
    assert batch.accounts[0].provider_account_id == "stripe:platform"
    txn = batch.transactions[0]
    assert txn.provider_transaction_id == "pi_123"
    assert txn.direction == "inflow"
    assert txn.status == "posted"
    assert txn.amount == Decimal("125.00")
    assert txn.currency == "USD"
    assert txn.category == "sales_revenue"
    assert txn.metadata["stripe_event_id"] == "evt_123"


def test_unpaid_stripe_checkout_is_rejected():
    event = _event()
    event["data"]["object"]["payment_status"] = "unpaid"
    with pytest.raises(StripeNormalizationError):
        normalize_verified_checkout_event(event)


def test_unsupported_stripe_event_is_rejected():
    event = _event(type="charge.refunded")
    with pytest.raises(StripeNormalizationError):
        normalize_verified_checkout_event(event)


def test_stripe_normalizer_does_not_require_or_expose_secrets():
    source = __import__("pathlib").Path("backend/moneyhub/providers/stripe.py").read_text()
    assert "STRIPE_SECRET_KEY" not in source
    assert "STRIPE_WEBHOOK_SECRET" not in source
    assert "httpx" not in source
