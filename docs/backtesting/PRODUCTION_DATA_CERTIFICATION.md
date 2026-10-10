# Backtesting production data certification

Backtesting remains research-only until every item below has evidence attached to a reproducible run manifest.

Required evidence:
- authorized/licensed market-data source and dataset identifier
- point-in-time universe construction
- inclusion of delisted securities where relevant
- split/dividend/corporate-action normalization policy
- exchange timezone and session-calendar normalization
- immutable content digest for every dataset snapshot
- timestamp-order tests proving no future data is visible at decision time
- survivorship-bias tests
- transaction-cost and slippage sensitivity
- parameter sensitivity and walk-forward validation
- immutable strategy/config/source revision identifiers
- independent regression fixtures

A missing item keeps the system in `engineering_verification` or `research_inconclusive`. No broker or order-execution path may be enabled by this certification document.
