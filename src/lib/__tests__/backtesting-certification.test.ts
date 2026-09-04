import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BACKTESTING_CERTIFICATION,
  evaluateBacktestingCertification,
} from '@/lib/backtesting-certification';

describe('backtesting certification gate', () => {
  it('keeps trading disabled by default', () => {
    expect(DEFAULT_BACKTESTING_CERTIFICATION.tradingEnabled).toBe(false);
    expect(DEFAULT_BACKTESTING_CERTIFICATION.researchOnly).toBe(true);
    expect(DEFAULT_BACKTESTING_CERTIFICATION.certificationState).toBe('RESEARCH_REVIEW_REQUIRED');
  });

  it('does not self-certify incomplete evidence', () => {
    const result = evaluateBacktestingCertification({
      dataLicenseVerified: false,
      executionModelIndependentlyReviewed: false,
      regressionFixturesPassed: false,
      productionOwnerApproved: false,
    });

    expect(result.certificationState).toBe('RESEARCH_REVIEW_REQUIRED');
    expect(result.tradingEnabled).toBe(false);
  });

  it('never enables trading even when research evidence is complete', () => {
    const result = evaluateBacktestingCertification({
      dataLicenseVerified: true,
      executionModelIndependentlyReviewed: true,
      regressionFixturesPassed: true,
      productionOwnerApproved: true,
    });

    expect(result.certificationState).toBe('RESEARCH_CERTIFIED');
    expect(result.tradingEnabled).toBe(false);
    expect(result.researchOnly).toBe(true);
  });
});
