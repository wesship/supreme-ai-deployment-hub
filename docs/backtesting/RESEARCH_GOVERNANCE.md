# Backtesting Research Governance

## Non-negotiable principles

1. Historical performance is research evidence, not a promise of future returns.
2. Synthetic/demo data is for engineering verification only.
3. No live order may be generated directly from a backtest result.
4. Every result must be reproducible from an immutable manifest.
5. Future information must never enter a historical decision.

## Promotion levels

### Level 0 — Engineering verification
Deterministic synthetic data, unit tests, UI verification, and numerical sanity checks.

### Level 1 — Historical research
Governed historical data, point-in-time controls, corporate-action normalization, realistic costs, and reproducible manifests.

### Level 2 — Robustness qualification
Train/validation/test separation, walk-forward analysis, stress testing, Monte Carlo, sensitivity analysis, and overfitting controls.

### Level 3 — Paper trading
Live market data with simulated execution, monitoring, reconciliation, and risk limits. No real orders.

### Level 4 — Live trading eligibility
Independent approval, separate execution controls, pre-trade risk checks, kill switch, audit logging, and explicit human authorization.

## Failure states

A strategy must be marked `research_inconclusive` when there are too few observations/trades, excessive sensitivity, insufficient validation, data-quality failures, or evidence of leakage/overfitting. It must never silently receive a passing score.

## Audit trail

Record strategy changes, data changes, parameter changes, validation runs, approvals, and production-promotion decisions. Preserve previous manifests rather than overwriting them.
