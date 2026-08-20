# Backtesting Production Readiness

## Purpose

Backtesting is a research and simulation system. A successful historical result is not evidence of future performance and must never directly authorize live trading.

## Research pipeline

`Strategy Definition -> Point-in-Time Data -> Historical Replay -> Execution Simulator -> Portfolio/Risk Engine -> Train/Validation/Test -> Stress Testing -> Monte Carlo -> Overfitting Analysis -> Benchmarking -> Immutable Result Manifest -> Paper Trading -> Human Approval -> Live Execution`

## Required integrity controls

- Point-in-time data only.
- No future bars, fundamentals, corporate actions, or metadata may influence a decision made before their availability timestamp.
- Preserve delisted symbols where the selected universe requires them.
- Normalize splits, dividends, trading calendars, symbol changes, and timestamps.
- Store the exact data snapshot/version used by every experiment.
- Separate training, validation, and final test periods.
- Parameter selection is permitted only on training data.
- The final test period is immutable and may not be repeatedly tuned against.
- Record strategy, parameters, engine version, data version, random seeds, cost assumptions, and timestamps.

## Execution model

The simulator must support configurable:

- bid/ask spread
- commissions and fees
- fixed and variable slippage
- market, limit, stop, and stop-limit orders
- partial fills
- liquidity/volume constraints
- gaps and overnight behavior
- market sessions and holidays
- rejected/cancelled orders
- cash, leverage, margin, and borrowing constraints

## Portfolio and risk controls

Support position sizing, maximum position and portfolio exposure, leverage limits, sector/asset concentration, volatility targeting, stop rules, portfolio heat, and correlation constraints.

## Required metrics

Core: total return, CAGR, volatility, Sharpe, Sortino, maximum drawdown, Calmar, Omega, win rate, profit factor, expectancy, turnover, exposure, recovery factor, time underwater, VaR, CVaR/expected shortfall, alpha, beta, and information ratio.

## Robustness testing

Run parameter sensitivity and transaction-cost sensitivity. Stress-test crisis, high-volatility, gap, and prolonged-bear regimes. Monte Carlo should support trade bootstrap, block bootstrap, randomized execution perturbations, drawdown probability, and probability of ruin.

## Overfitting controls

The production research layer should calculate or enforce:

- Deflated Sharpe Ratio
- Probability of Backtest Overfitting
- multiple-testing correction
- parameter-count/complexity penalties
- minimum trade and sample-size requirements
- holdout enforcement
- strategy complexity scoring

Results with insufficient statistical evidence must be explicitly labeled rather than promoted as robust.

## Result manifest

Every completed backtest should persist an immutable manifest containing:

- strategy definition and content hash
- parameter set
- dataset/provider and snapshot ID
- engine version/commit
- execution assumptions
- portfolio constraints
- validation windows
- random seeds
- generated metrics
- benchmark results
- integrity/robustness checks
- creation timestamp

## Research score

The UI should expose a research-quality score across data quality, bias controls, execution realism, validation, statistical evidence, reproducibility, and risk controls. The score is informational and must not be presented as a guarantee of profitability.

## Safety boundary

Backtesting results cannot submit live orders. Any future paper/live trading integration must cross an explicit human-approval boundary and use a separate execution service with independent risk controls and audit logging.

## Production gate

The deterministic synthetic dataset currently used for UI/math verification is not a substitute for licensed/governed historical market data. Production promotion requires an approved data provider, normalized historical dataset, independent regression fixtures with known expected metrics, security/CI checks, deployment verification, and review of the complete research-integrity evidence.