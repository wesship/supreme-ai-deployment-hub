import { describe, expect, it } from 'vitest';
import evidence from '../../../docs/backtesting/CERTIFICATION_EVIDENCE_TEMPLATE.json';

describe('backtesting certification gate', () => {
  it('keeps trading disabled by default', () => {
    expect(evidence.trading_enabled).toBe(false);
    expect(evidence.research_only).toBe(true);
  });

  it('does not self-certify incomplete evidence', () => {
    expect(evidence.certification_state).toBe('RESEARCH_REVIEW_REQUIRED');
    expect(evidence.data.license_verified).toBe(false);
    expect(evidence.execution_model.independent_review).toBeNull();
    expect(evidence.validation.independent_regression_fixtures_passed).toBe(false);
    expect(evidence.approvals.production_owner).toBeNull();
  });
});
