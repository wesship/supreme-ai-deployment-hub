# MoneyHub Foundation

MoneyHub is the D3VONN.IO capital control plane. This first release intentionally establishes financial truth and governance before any live brokerage or autonomous capital deployment.

## Phase 1 guarantees

- Double-entry journal model: every governed post must have equal debits and credits.
- Immutable posted history: journals and entries are never edited or deleted; corrections use reversing journals.
- Idempotent posting: `(owner_id, idempotency_key)` prevents duplicate financial events.
- Owner isolation: authenticated users can only read MoneyHub records owned by their user identity.
- Backend-only mutation: financial writes and posting RPCs are restricted to `service_role`.
- Currency consistency: every account in a journal must use the journal currency.
- Account validation: only active accounts owned by the journal owner may be posted.
- Agent attribution: accounts, journals, and entries can identify the responsible agent/project/source.
- Derived balances: account balances come from ledger entries rather than a mutable balance field.
- Capital controls: per-agent budgets and scoped risk limits include order/position caps, approval thresholds, drawdown controls, and a kill switch.

## Core tables

- `moneyhub_accounts` — chart of accounts and optional agent/business attribution.
- `moneyhub_journals` — immutable financial events and idempotency boundary.
- `moneyhub_entries` — debit/credit lines.
- `moneyhub_agent_budgets` — governed agent capital envelopes.
- `moneyhub_risk_limits` — global/agent/strategy/account/asset/business-unit limits.

## Core RPCs

### `moneyhub_post_journal`

Backend-only atomic posting function. It validates identity ownership, account status, currency, entry shape, idempotency, and debit/credit equality before writing the journal and its entries.

### `moneyhub_reverse_journal`

Backend-only reversal function. It creates an opposite journal instead of modifying prior financial history.

## Read model

`moneyhub_account_balances` derives account balances from entries using each account's normal balance. Client applications should treat the ledger and its derived views as the source of truth rather than maintaining independent balance state.

## Recommended application flow

```text
Business event / Hermes agent
        |
        v
D3VONN backend policy + authorization
        |
        +--> MoneyHub agent budget / risk checks
        |
        v
moneyhub_post_journal(...)
        |
        v
Immutable journal + entries
        |
        +--> balances / P&L / audit / analytics
```

## Trading progression

Live trading is deliberately not enabled by this migration. Trading should graduate through:

```text
Backtest -> walk-forward -> paper -> shadow-live -> small-capital live -> review -> scale/disable
```

Before a strategy reaches real capital, the execution layer should enforce MoneyHub risk limits, approval thresholds, a global kill switch, server-only broker credentials, disabled withdrawals, execution receipts, and independent broker reconciliation.

## Next implementation slice

1. MoneyHub backend service/API using server-derived owner identity.
2. Journal/account integration tests and migration replay tests.
3. Revenue/expense ingestion adapters and agent cost attribution.
4. Agent P&L and executive dashboard read models.
5. Paper-trading account/strategy schema and risk-policy evaluator.
6. Reconciliation workflow for external payment/bank/broker events.
