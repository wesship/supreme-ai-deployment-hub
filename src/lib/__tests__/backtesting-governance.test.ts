import { describe, expect, it } from 'vitest';
import { DEFAULT_BACKTEST_CONFIG, generateSyntheticData, runBacktest } from '@/lib/backtesting';
import { calculateAdvancedMetrics, evaluateResearchGate } from '@/lib/backtesting-governance';

describe('backtesting research governance', () => {
  it('keeps synthetic data in engineering verification', () => {
    const bars = generateSyntheticData('SPY', 756, 42);
    const result = runBacktest(bars, DEFAULT_BACKTEST_CONFIG);
    const gate = evaluateResearchGate({ result, config: DEFAULT_BACKTEST_CONFIG, bars, dataProvenance: 'synthetic' });
    expect(gate.status).toBe('engineering_verification');
    expect(gate.reasons).toContain('Data provenance is not governed historical market data.');
  });

  it('requires sufficient history and trades before research qualification', () => {
    const bars = generateSyntheticData('QQQ', 100, 11);
    const result = runBacktest(bars, DEFAULT_BACKTEST_CONFIG);
    const gate = evaluateResearchGate({ result, config: DEFAULT_BACKTEST_CONFIG, bars, dataProvenance: 'governed_historical' });
    expect(gate.status).toBe('research_inconclusive');
    expect(gate.checks.sufficientHistory).toBe(false);
    expect(gate.checks.sufficientTrades).toBe(false);
  });

  it('calculates advanced metrics deterministically', () => {
    const bars = generateSyntheticData('IWM', 756, 21);
    const result = runBacktest(bars, DEFAULT_BACKTEST_CONFIG);
    expect(calculateAdvancedMetrics(result)).toEqual(calculateAdvancedMetrics(result));
  });
});
