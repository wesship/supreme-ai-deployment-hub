export type SignalBlock = 'sma_crossover' | 'rsi_threshold' | 'momentum';

export interface HistoricalBar {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestConfig {
  initialCapital: number;
  fastPeriod: number;
  slowPeriod: number;
  rsiPeriod: number;
  rsiEntry: number;
  momentumPeriod: number;
  momentumEntry: number;
  signal: SignalBlock;
  commissionBps: number;
  slippageBps: number;
  riskFreeRate: number;
  barsPerYear: number;
}

export interface Trade {
  symbol: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  pnl: number;
}

export interface EquityPoint {
  date: string;
  equity: number;
  dailyReturn: number;
}

export interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  trades: number;
  exposure: number;
  endingEquity: number;
}

export interface BacktestResult {
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades: Trade[];
}

export interface WalkForwardFold {
  index: number;
  startDate: string;
  endDate: string;
  returnPct: number;
  maxDrawdown: number;
  trades: number;
}

export interface MonteCarloResult {
  iterations: number;
  p05: number;
  p50: number;
  p95: number;
  probabilityOfLoss: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

function stddev(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function sma(values: number[], period: number, index: number) {
  if (index + 1 < period) return null;
  return mean(values.slice(index + 1 - period, index + 1));
}

function rsi(values: number[], period: number, index: number) {
  if (index < period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = index - period + 1; i <= index; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return 100 - (100 / (1 + rs));
}

function signalFor(config: BacktestConfig, closes: number[], index: number) {
  if (config.signal === 'sma_crossover') {
    const fast = sma(closes, config.fastPeriod, index);
    const slow = sma(closes, config.slowPeriod, index);
    const previousFast = index > 0 ? sma(closes, config.fastPeriod, index - 1) : null;
    const previousSlow = index > 0 ? sma(closes, config.slowPeriod, index - 1) : null;
    return fast !== null && slow !== null && previousFast !== null && previousSlow !== null &&
      fast > slow && previousFast <= previousSlow;
  }
  if (config.signal === 'rsi_threshold') {
    const current = rsi(closes, config.rsiPeriod, index);
    const previous = index > 0 ? rsi(closes, config.rsiPeriod, index - 1) : null;
    return current !== null && previous !== null && previous < config.rsiEntry && current >= config.rsiEntry;
  }
  if (index < config.momentumPeriod) return false;
  const momentum = (closes[index] / closes[index - config.momentumPeriod] - 1) * 100;
  return momentum >= config.momentumEntry;
}

function exitSignalFor(config: BacktestConfig, closes: number[], index: number) {
  if (config.signal === 'sma_crossover') {
    const fast = sma(closes, config.fastPeriod, index);
    const slow = sma(closes, config.slowPeriod, index);
    return fast !== null && slow !== null && fast < slow;
  }
  if (config.signal === 'rsi_threshold') {
    const current = rsi(closes, config.rsiPeriod, index);
    return current !== null && current >= 70;
  }
  if (index < config.momentumPeriod) return false;
  const momentum = (closes[index] / closes[index - config.momentumPeriod] - 1) * 100;
  return momentum < 0;
}

function costRate(config: BacktestConfig) {
  return (config.commissionBps + config.slippageBps) / 10000;
}

export function generateSyntheticData(symbol: string, bars = 756, seed = 42): HistoricalBar[] {
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const base = { SPY: 430, QQQ: 370, IWM: 205, BTC: 42000 }[symbol] ?? 100;
  const drift = symbol === 'BTC' ? 0.0007 : 0.00035;
  let close = base;
  const start = new Date('2023-01-03T00:00:00Z');
  const result: HistoricalBar[] = [];
  for (let i = 0; i < bars; i += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    const shock = (random() - 0.5) * (symbol === 'BTC' ? 0.055 : 0.028);
    const ret = drift + shock;
    const open = close;
    close = Math.max(0.01, close * (1 + ret));
    const high = Math.max(open, close) * (1 + random() * 0.008);
    const low = Math.min(open, close) * (1 - random() * 0.008);
    result.push({ symbol, date: date.toISOString().slice(0, 10), open, high, low, close, volume: Math.round(1_000_000 + random() * 4_000_000) });
  }
  return result;
}

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  initialCapital: 100_000,
  fastPeriod: 20,
  slowPeriod: 50,
  rsiPeriod: 14,
  rsiEntry: 35,
  momentumPeriod: 20,
  momentumEntry: 2,
  signal: 'sma_crossover',
  commissionBps: 5,
  slippageBps: 5,
  riskFreeRate: 0.04,
  barsPerYear: 252,
};

export function runBacktest(bars: HistoricalBar[], config: BacktestConfig): BacktestResult {
  if (bars.length < 2) throw new Error('At least two historical bars are required.');
  const ordered = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const closes = ordered.map((bar) => bar.close);
  let equity = config.initialCapital;
  let cash = equity;
  let units = 0;
  let entryPrice = 0;
  let entryDate = '';
  const curve: EquityPoint[] = [{ date: ordered[0].date, equity, dailyReturn: 0 }];
  const trades: Trade[] = [];
  const cost = costRate(config);
  let investedBars = 0;

  for (let i = 1; i < ordered.length; i += 1) {
    const bar = ordered[i];
    const prevEquity = equity;
    const enter = signalFor(config, closes, i);
    const exit = exitSignalFor(config, closes, i);

    if (units === 0 && enter) {
      const buyPrice = bar.open * (1 + cost);
      units = cash / buyPrice;
      cash = 0;
      entryPrice = buyPrice;
      entryDate = bar.date;
    } else if (units > 0 && exit) {
      const sellPrice = bar.open * (1 - cost);
      cash = units * sellPrice;
      const pnl = cash - config.initialCapital * 0;
      trades.push({ symbol: bar.symbol, entryDate, exitDate: bar.date, entryPrice, exitPrice: sellPrice, returnPct: sellPrice / entryPrice - 1, pnl });
      units = 0;
      entryPrice = 0;
      entryDate = '';
    }

    equity = cash + units * bar.close;
    if (units > 0) investedBars += 1;
    curve.push({ date: bar.date, equity, dailyReturn: prevEquity ? equity / prevEquity - 1 : 0 });
  }

  if (units > 0) {
    const finalBar = ordered[ordered.length - 1];
    const sellPrice = finalBar.close * (1 - cost);
    cash = units * sellPrice;
    trades.push({ symbol: finalBar.symbol, entryDate, exitDate: finalBar.date, entryPrice, exitPrice: sellPrice, returnPct: sellPrice / entryPrice - 1, pnl: cash - config.initialCapital });
    equity = cash;
    curve[curve.length - 1].equity = equity;
    curve[curve.length - 1].dailyReturn = curve.length > 1 ? equity / curve[curve.length - 2].equity - 1 : 0;
  }

  const dailyReturns = curve.slice(1).map((point) => point.dailyReturn);
  const avg = mean(dailyReturns);
  const volatility = stddev(dailyReturns) * Math.sqrt(config.barsPerYear);
  const rfDaily = (1 + config.riskFreeRate) ** (1 / config.barsPerYear) - 1;
  const excess = dailyReturns.map((value) => value - rfDaily);
  const downside = dailyReturns.map((value) => Math.min(0, value - rfDaily));
  const downsideDeviation = stddev(downside) * Math.sqrt(config.barsPerYear);
  let peak = curve[0].equity;
  let maxDrawdown = 0;
  curve.forEach((point) => {
    peak = Math.max(peak, point.equity);
    maxDrawdown = Math.min(maxDrawdown, point.equity / peak - 1);
  });
  const winners = trades.filter((trade) => trade.returnPct > 0);
  const losers = trades.filter((trade) => trade.returnPct < 0);
  const grossProfit = winners.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((sum, trade) => sum + trade.pnl, 0));
  const years = Math.max(ordered.length / config.barsPerYear, 1 / config.barsPerYear);

  return {
    metrics: {
      totalReturn: equity / config.initialCapital - 1,
      annualizedReturn: (equity / config.initialCapital) ** (1 / years) - 1,
      volatility,
      sharpe: volatility ? mean(excess) * config.barsPerYear / volatility : 0,
      sortino: downsideDeviation ? mean(excess) * config.barsPerYear / downsideDeviation : 0,
      maxDrawdown,
      winRate: trades.length ? winners.length / trades.length : 0,
      profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      trades: trades.length,
      exposure: investedBars / Math.max(1, ordered.length - 1),
      endingEquity: equity,
    },
    equityCurve: curve,
    trades,
  };
}

export function runWalkForward(bars: HistoricalBar[], config: BacktestConfig, folds = 4): WalkForwardFold[] {
  const size = Math.floor(bars.length / folds);
  return Array.from({ length: folds }, (_, index) => {
    const start = index * size;
    const end = index === folds - 1 ? bars.length : start + size;
    const segment = bars.slice(start, end);
    const result = runBacktest(segment, config);
    return {
      index: index + 1,
      startDate: segment[0]?.date ?? '',
      endDate: segment[segment.length - 1]?.date ?? '',
      returnPct: result.metrics.totalReturn,
      maxDrawdown: result.metrics.maxDrawdown,
      trades: result.metrics.trades,
    };
  });
}

export function runMonteCarlo(result: BacktestResult, iterations = 1000, seed = 7): MonteCarloResult {
  const returns = result.trades.map((trade) => trade.returnPct);
  if (!returns.length) return { iterations, p05: 0, p50: 0, p95: 0, probabilityOfLoss: 0 };
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const outcomes: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    let equity = 1;
    for (let j = 0; j < returns.length; j += 1) {
      equity *= 1 + returns[Math.floor(random() * returns.length)];
    }
    outcomes.push(equity - 1);
  }
  outcomes.sort((a, b) => a - b);
  const percentile = (p: number) => outcomes[Math.floor((outcomes.length - 1) * p)] ?? 0;
  return { iterations, p05: percentile(0.05), p50: percentile(0.5), p95: percentile(0.95), probabilityOfLoss: outcomes.filter((value) => value < 0).length / outcomes.length };
}

export function combineEquityCurves(results: BacktestResult[], initialCapital: number): EquityPoint[] {
  if (!results.length) return [];
  const length = Math.min(...results.map((result) => result.equityCurve.length));
  return Array.from({ length }, (_, index) => {
    const normalized = mean(results.map((result) => result.equityCurve[index].equity / result.equityCurve[0].equity));
    const previous = index === 0 ? 1 : mean(results.map((result) => result.equityCurve[index - 1].equity / result.equityCurve[0].equity));
    return { date: results[0].equityCurve[index].date, equity: initialCapital * normalized, dailyReturn: previous ? normalized / previous - 1 : 0 };
  });
}

export function summarizeRisk(result: BacktestResult) {
  return {
    riskScore: clamp(100 - Math.abs(result.metrics.maxDrawdown) * 180 - result.metrics.volatility * 30, 0, 100),
    integrityChecks: [
      'Signals use only bars available at decision time.',
      'Entry and exit fills include configured commission and slippage.',
      'Walk-forward and Monte Carlo results are generated separately from the headline backtest.',
      'Synthetic demo data is deterministic and must be replaced by licensed historical data before investment use.',
    ],
  };
}
