from pathlib import Path

from backend.moneyhub.adapters import (
    NormalizedTransaction,
    classify_transaction,
    transaction_idempotency_key,
)


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260929100000_moneyhub_provider_neutral_financial_sources.sql"


def test_provider_neutral_migration_preserves_browser_read_only_boundary():
    sql = MIGRATION.read_text()
    for table in (
        "moneyhub_financial_sources",
        "moneyhub_financial_accounts",
        "moneyhub_financial_transactions",
    ):
        assert f"alter table public.{table} enable row level security" in sql
        assert f"revoke insert, update, delete on public.{table} from anon, authenticated" in sql
        assert f"grant select on public.{table} to authenticated" in sql


def test_transaction_idempotency_is_provider_account_transaction_scoped():
    txn = NormalizedTransaction(
        provider="demo",
        provider_account_id="acct-1",
        provider_transaction_id="txn-1",
        amount="-12.50",
        currency="usd",
        direction="outflow",
        status="posted",
        occurred_at="2026-09-29T12:00:00Z",
    )
    assert transaction_idempotency_key(txn) == "demo:acct-1:txn-1"
    assert txn.amount > 0
    assert txn.currency == "USD"


def test_transfer_classification_is_explicit_not_inferred():
    txn = NormalizedTransaction(
        provider="demo",
        provider_account_id="acct-1",
        provider_transaction_id="txn-2",
        amount="500",
        direction="inflow",
        status="pending",
        occurred_at="2026-09-29T12:00:00Z",
        is_transfer=True,
        transfer_group_id="transfer-7",
    )
    result = classify_transaction(txn)
    assert result["transfer"] is True
    assert result["pending"] is True
    assert result["flow"] == "inflow"
