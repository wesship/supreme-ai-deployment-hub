from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from backend.moneyhub.adapters import NormalizedAccount, NormalizedTransaction, ProviderBatch


class StripeNormalizationError(ValueError):
    pass


_ALLOWED_TYPES = {
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
}


def _required_text(value: Any, field: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise StripeNormalizationError(f"missing Stripe field: {field}")
    return text


def normalize_verified_checkout_event(event: dict[str, Any]) -> ProviderBatch:
    """
    Normalize a previously verified Stripe checkout event into MoneyHub's
    provider-neutral contract.

    Signature verification must happen upstream. This function never accepts or
    validates webhook secrets and never performs provider-side mutations.
    """
    event_type = _required_text(event.get("type"), "type")
    if event_type not in _ALLOWED_TYPES:
        raise StripeNormalizationError("unsupported Stripe event type")

    obj = ((event.get("data") or {}).get("object") or {})
    if not isinstance(obj, dict):
        raise StripeNormalizationError("invalid Stripe event object")

    payment_status = str(obj.get("payment_status") or "").strip().lower()
    if payment_status != "paid":
        raise StripeNormalizationError("Stripe checkout is not paid")

    event_id = _required_text(event.get("id"), "id")
    checkout_id = _required_text(obj.get("id"), "data.object.id")
    payment_intent = _required_text(obj.get("payment_intent"), "payment_intent")
    currency = _required_text(obj.get("currency"), "currency").upper()
    amount_total = obj.get("amount_total")
    if not isinstance(amount_total, int) or amount_total <= 0:
        raise StripeNormalizationError("amount_total must be a positive integer")

    created = obj.get("created") or event.get("created")
    if not isinstance(created, (int, float)):
        raise StripeNormalizationError("created timestamp is required")

    occurred_at = datetime.fromtimestamp(float(created), tz=timezone.utc)
    metadata = obj.get("metadata") if isinstance(obj.get("metadata"), dict) else {}

    provider_account_id = "stripe:platform"
    transaction = NormalizedTransaction(
        provider="stripe",
        provider_account_id=provider_account_id,
        provider_transaction_id=payment_intent,
        amount=Decimal(amount_total) / Decimal("100"),
        currency=currency,
        direction="inflow",
        status="posted",
        occurred_at=occurred_at,
        posted_at=occurred_at,
        description=f"Stripe checkout {checkout_id}",
        merchant="Stripe",
        category="sales_revenue",
        is_transfer=False,
        confidence="high",
        metadata={
            "stripe_event_id": event_id,
            "stripe_checkout_session_id": checkout_id,
            "order_id": metadata.get("order_id"),
            "workspace_id": metadata.get("workspace_id"),
        },
    )

    account = NormalizedAccount(
        provider="stripe",
        provider_account_id=provider_account_id,
        account_name="Stripe platform",
        account_type="payment",
        currency=currency,
        metadata={"source": "verified_checkout_webhook"},
    )

    return ProviderBatch(
        source_kind="payment",
        provider="stripe",
        cursor=event_id,
        accounts=[account],
        transactions=[transaction],
    )
