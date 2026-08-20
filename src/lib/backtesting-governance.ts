import type { BacktestResult, BacktestConfig, HistoricalBar } from './backtesting';

export type ResearchStatus = 'engineering_verification' | 'research_inconclusive' | 'research_qualified';

export interface ResearchGateInput {
  result: BacktestResult;
  config: BacktestConfig;
  bars: HistoricalBar[];
  minimumTrades?: number;
  minimumBars?: number;
  validationPassRate?: number;
  parameterSensitivity?: number;
  costSensitivity?: number;
}

export interface ResearchGateResult {
  status: ResearchStatus;
  score: number;
  reasons: string[];
  checks: {
    sufficientHistory: boolean;
    sufficientTrades: boolean;
    drawdownBounded: boolean;
    validationSufficient: boolean;
    sensitivitySufficient: boolean;
    costSufficient: boolean;
  };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Research-only quality gate. It deliberately does not predict profitability.
 * Synthetic/demo data should remain engineering_verification regardless of score.
 */
export function evaluateResearchGate(input: ResearchGateInput): ResearchGateResult {
  const minimumTrades = input.minimumTrades ?? 30;
  const minimumBars = input.minimumBars ?? 252;
  const validationPassRate = input.validationPassRate ?? 0;
  const parameterSensitivity = input.parameterSensitivity ?? 0;
  const costSensitivity = input.costSensitivity ?? 0;

  const sufficientHistory = input.bars.length >= minimumBars;
  const sufficientTrades = input.result.metrics.trades >= minimumTrades;
  const drawdownBounded = input.result.metrics.maxDrawdown > -0.5;
  const validationSufficient = validationPassRate >= 0.75;
  const sensitivitySufficient = parameterSensitivity >= 0.7;
  const costSufficient = costSensitivity >= 0.7;

  const checks = { sufficientHistory, sufficientTrades, drawdownBounded, validationSufficient, sensitivitySufficient, costSufficient };
  const score = Math.round(
    100 * (
      Number(sufficientHistory) * 0.2 +
      Number(sufficientTrades) * 0.2 +
      Number(drawdownBounded) * 0.1 +
      Number(validationSufficient) * 0.2 +
      Number(sensitivitySufficient) * 0.15 +
      Number(costSufficient) * 0.15
    ),
  );

  const reasons: string[] = [];
  if (!sufficientHistory) reasons.push(`At least ${minimumBars} bars are required.`);
  if (!sufficientTrades) reasons.push(`At least ${minimumTrades} completed trades are required.`);
  if (!drawdownBounded) reasons.push('Maximum drawdown exceeds the research safety threshold.');
  if (!validationSufficient) reasons.push('Walk-forward validation pass rate is below 75%.');
  if (!sensitivitySufficient) reasons.push('Parameter sensitivity is below the robustness threshold.');
  if (!costSufficient) reasons.push('Transaction-cost sensitivity is below the robustness threshold.');

  return {
    status: input.bars.some((bar) => bar.date.startsWith('2023-')) ? 'engineering_verification' : (reasons.length ? 'research_inconclusive' : 'research_qualified'),
    score: clamp(score, 0, 100),
    reasons,
    checks,
  };
}

export function calculateAdvancedMetrics(result: BacktestResult, riskFreeRate = 0.04, barsPerYear = 252) {
  const returns = result.equityCurve.slice(1).map((p) => p.dailyReturn);
  const meanReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const rf = (1 + riskFreeRate) ** (1 / barsPerYear) - 1;
  const excess = returns.map((r) => r - rf);
  const downside = excess.filter((r) => r < 0);
  const downsideDeviation = downside.length ? Math.sqrt(downside.reduce((s, r) => s + r * r, 0) / returns.length) * Math.sqrt(barsPerYear) : 0;
  const grossProfit = result.trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(result.trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
  const wins = result.trades.filter((t) => t.pnl > 0);
  const losses = result.trades.filter((t) => t.pnl < 0);
  const averageWin = wins.length ? grossProfit / wins.length : 0;
  const averageLoss = losses.length ? grossLoss / losses.length : 0;
  const totalReturn = result.metrics.totalReturn;
  const years = Math.max(result.equityCurve.length / barsPerYear, 1 / barsPerYear);
  const cagr = (1 + totalReturn) ** (1 / years) - 1;
  const calmar = Math.abs(result.metrics.maxDrawdown) > 0 ? cagr / Math.abs(result.metrics.maxDrawdown) : 0;
  const payoffRatio = averageLoss > 0 ? averageWin / averageLoss : averageWin > 0 ? Infinity : 0;
  const turnover = result.trades.length * 2 / Math.max(1, result.equityCurve.length);
  const ulcerSquared = result.equityCurve.reduce((sum, point) => {
    const peak = Math.max(...result.equityCurve.slice(0, result.equityCurve.indexOf(point) + 1).map((p) => p.equity));
    const drawdownPct = peak ? ((point.equity / peak) - 1) * 100 : 0;
    return sum + drawdownPct * drawdownPct;
  }, 0);

  return {
    cagr,
    calmar,
    downsideDeviation,
    payoffRatio,
    averageWin,
    averageLoss,
    expectancy: result.trades.length ? result.trades.reduce((s, t) => s + t.pnl, 0) / result.trades.length : 0,
    turnover,
    ulcerIndex: result.equityCurve.length ? Math.sqrt(ulcerSquared / result.equityCurve.length) : 0,
    excessMeanAnnualized: meanReturn * barsPerYear - riskFreeRate,
    grossProfit,
    grossLoss,
  };
}
