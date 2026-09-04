# Backtesting Production Certification Gate

Status: **NOT CERTIFIED FOR PRODUCTION TRADING**

This gate sits on top of the deterministic research core. Passing research checks does not authorize brokerage connectivity, order submission, autonomous allocation, or production trading.

## Required evidence before production research certification

1. **Governed market data** — licensed/provider-approved historical data with immutable snapshot identity, source/version, acquisition timestamp, and reproducible checksum.
2. **Market-data normalization** — trading calendars, timezone normalization, splits, dividends, symbol changes, delistings, and other corporate actions handled explicitly.
3. **Bias controls** — survivorship-bias controls and point-in-time membership/metadata where applicable.
4. **Leakage controls** — automated tests proving signals and parameter selection cannot consume future observations.
5. **Execution-model validation** — documented and independently checked assumptions for spread, slippage, commissions, liquidity, partial fills, market hours, rejected fills, and unavailable prices.
6. **Portfolio constraints** — explicit sizing, cash, leverage, margin, exposure, concentration, and loss limits before any portfolio-level research claim.
7. **Robustness evidence** — parameter sensitivity, transaction-cost sensitivity, train/validation/test walk-forward methodology, and reproducible Monte Carlo variants.
8. **Immutable manifest** — strategy hash, code/engine version, configuration, data snapshot ID/hash, random seeds, run timestamps, environment, and result hash.
9. **Independent fixtures** — known-input/known-output regression fixtures that do not depend on synthetic pseudo-market behavior alone.
10. **Operational controls** — CI/security gates, audit logging, rollback procedure, owner approval, and a separately reviewed authorization boundary for any consequential trading action.

## Certification states

- `ENGINEERING_ONLY`: deterministic/synthetic verification only.
- `RESEARCH_REVIEW_REQUIRED`: governed inputs may exist, but one or more production-research gates remain unproven.
- `RESEARCH_CERTIFIED`: historical research controls have complete reviewed evidence. This still does **not** authorize trading.
- `TRADING_DISABLED`: mandatory default for this gate and all evidence templates in this change.

No certification state in this gate authorizes live or paper order execution. A separate broker/execution safety review would be required for that capability.
