import { describe, expect, it } from 'vitest';
import { DEFAULT_BACKTEST_CONFIG, generateSyntheticData, runBacktest, runMonteCarlo, runWalkForward } from '@/lib/backtesting';

describe('backtesting engine', () => {
  it('generates deterministic historical bars', () => {
    const first = generateSyntheticData('SPY', 100, 42);
    const second = generateSyntheticData('SPY', 100, 42);
    expect(first).toEqual(second);
    expect(first).toHaveLength(100);
  });

  it('replays with costs and finite core metrics', () => {
    const result = runBacktest(generateSyntheticData('SPY', 756, 42), DEFAULT_BACKTEST_CONFIG);
    expect(Number.isFinite(result.metrics.totalReturn)).toBe(true);
    expect(Number.isFinite(result.metrics.maxDrawdown)).toBe(true);
    expect(result.metrics.maxDrawdown).toBeLessThanOrEqual(0);
    expect(result.metrics.exposure).toBeGreaterThanOrEqual(0);
    expect(result.metrics.exposure).toBeLessThanOrEqual(1);
  });

  it('produces deterministic validation folds', () => {
    const bars = generateSyntheticData('QQQ', 800, 11);
    const folds = runWalkForward(bars, DEFAULT_BACKTEST_CONFIG, 4);
    expect(folds).toHaveLength(4);
    expect(folds[0].startDate).toBe(bars[0].date);
    expect(folds[3].endDate).toBe(bars[bars.length - 1].date);
  });

  it('makes Monte Carlo reproducible for the same seed', () => {
    const result = runBacktest(generateSyntheticData('IWM', 756, 21), DEFAULT_BACKTEST_CONFIG);
    expect(runMonteCarlo(result, 250, 9)).toEqual(runMonteCarlo(result, 250, 9));
  });
});
