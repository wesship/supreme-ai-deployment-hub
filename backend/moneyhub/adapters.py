from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class NormalizedAccount(BaseModel):
    provider: str = Field(min_length=1, max_length=80)
    provider_account_id: str = Field(min_length=1, max_length=200)
    account_name: str | None = Field(default=None, max_length=200)
    account_type: Literal["checking", "savings", "credit", "loan", "brokerage", "payment", "other"]
    currency: str = Field(default="USD", min_length=3, max_length=3)
    current_balance: Decimal | None = Field(default=None, max_digits=18, decimal_places=2)
    available_balance: Decimal | None = Field(default=None, max_digits=18, decimal_places=2)
    balance_observed_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) != 3 or not normalized.isalpha():
            raise ValueError("currency must be a three-letter ISO code")
        return normalized


class NormalizedTransaction(BaseModel):
    provider: str = Field(min_length=1, max_length=80)
    provider_account_id: str = Field(min_length=1, max_length=200)
    provider_transaction_id: str = Field(min_length=1, max_length=240)
    amount: Decimal = Field(max_digits=18, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    direction: Literal["inflow", "outflow"]
    status: Literal["pending", "posted"]
    occurred_at: datetime
    posted_at: datetime | None = None
    description: str | None = Field(default=None, max_length=1000)
    merchant: str | None = Field(default=None, max_length=300)
    category: str | None = Field(default=None, max_length=160)
    is_transfer: bool = False
    transfer_group_id: str | None = Field(default=None, max_length=240)
    confidence: Literal["high", "medium", "low"] = "high"
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) != 3 or not normalized.isalpha():
            raise ValueError("currency must be a three-letter ISO code")
        return normalized

    @field_validator("occurred_at", "posted_at")
    @classmethod
    def ensure_timezone(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    @field_validator("amount")
    @classmethod
    def require_nonzero_amount(cls, value: Decimal) -> Decimal:
        if value == 0:
            raise ValueError("amount must be non-zero")
        return abs(value)


class ProviderBatch(BaseModel):
    source_kind: Literal["bank", "payment", "accounting", "brokerage", "manual"]
    provider: str = Field(min_length=1, max_length=80)
    cursor: str | None = Field(default=None, max_length=500)
    accounts: list[NormalizedAccount] = Field(default_factory=list, max_length=200)
    transactions: list[NormalizedTransaction] = Field(default_factory=list, max_length=5000)


def transaction_idempotency_key(txn: NormalizedTransaction) -> str:
    return f"{txn.provider}:{txn.provider_account_id}:{txn.provider_transaction_id}"


def classify_transaction(txn: NormalizedTransaction) -> dict[str, Any]:
    return {
        "idempotency_key": transaction_idempotency_key(txn),
        "flow": txn.direction,
        "pending": txn.status == "pending",
        "transfer": txn.is_transfer,
        "recurring_candidate": False,
        "category": txn.category or "uncategorized",
        "confidence": txn.confidence,
    }
