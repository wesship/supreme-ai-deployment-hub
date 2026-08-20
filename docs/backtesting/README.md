# Backtesting

Backtesting provides governed historical strategy research and simulation.

## Current implementation

The initial workspace provides reusable signal blocks, deterministic replay, transaction-cost modeling, risk-adjusted metrics, equity curves, walk-forward folds, Monte Carlo validation, and integrity messaging.

## Production roadmap

The next gate is governed point-in-time market data and a realistic execution/portfolio simulator. See [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) and [RESEARCH_GOVERNANCE.md](./RESEARCH_GOVERNANCE.md).

## Important boundary

The current deterministic dataset is deliberately not represented as licensed market history. Backtest output must remain research-only until the production gates are satisfied.
