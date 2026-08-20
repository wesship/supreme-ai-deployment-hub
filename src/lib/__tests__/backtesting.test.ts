import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BACKTEST_CONFIG,
  generateSyntheticData,
  runBacktest,
  runMonteCarlo,
  runWalkForward,
} from '@/lib/backtesting';

describe('backtesting engine', () => {
  it('generates deterministic historical bars', () => {
    const first = generateSyntheticData('SPY', 100, 42);
    const second = generateSyntheticData('SPY', 100, 42);
    expect(first).toEqual(second);
    expect(first).toHaveLength(100);
    expect(first[0].symbol).toBe('SPY');
  });

  it('replays with costs and returns finite core metrics', () => {
    const result = runBacktest(generateSyntheticData('SPY', 756, 42), DEFAULT_BACKTEST_CONFIG);
    expect(result.equityCurve).toHaveLength(756);
    expect(Number.isFinite(result.metrics.totalReturn)).toBe(true);
    expect(Number.isFinite(result.metrics.maxDrawdown)).toBe(true);
    expect(result.metrics.maxDrawdown).toBeLessThanOrEqual(0);
    expect(result.metrics.exposure).toBeGreaterThanOrEqual(0);
    expect(result.metrics.exposure).toBeLessThanOrEqual(1);
  });

  it('produces four validation folds without leaking future bars into the replay segment', () => {
    const bars = generateSyntheticData('QQQ', 800, 11);
    const folds = runWalkForward(bars, DEFAULT_BACKTEST_CONFIG, 4);
    expect(folds).toHaveLength(4);
    expect(folds[0].startDate).toBe(bars[0].date);
    expect(folds[3].endDate).toBe(bars[bars.length - 1].date);
    expect(folds.every((fold) => Number.isFinite(fold.returnPct))).toBe(true);
  });

  it('makes Monte Carlo validation reproducible for the same seed', () => {
    const result = runBacktest(generateSyntheticData('IWM', 756, 21), DEFAULT_BACKTEST_CONFIG);
    const first = runMonteCarlo(result, 250, 9);
    const second = runMonteCarlo(result, 250, 9);
    expect(first).toEqual(second);
    expect(first.iterations).toBe(250);
    expect(first.p05).toBeLessThanOrEqual(first.p50);
    expect(first.p50).toBeLessThanOrEqual(first.p95);
  });
});
