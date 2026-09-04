export type BacktestingCertificationState =
  | 'ENGINEERING_ONLY'
  | 'RESEARCH_REVIEW_REQUIRED'
  | 'RESEARCH_CERTIFIED';

export interface BacktestingCertificationEvidence {
  certificationState: BacktestingCertificationState;
  tradingEnabled: false;
  researchOnly: true;
  dataLicenseVerified: boolean;
  executionModelIndependentlyReviewed: boolean;
  regressionFixturesPassed: boolean;
  productionOwnerApproved: boolean;
}

export const DEFAULT_BACKTESTING_CERTIFICATION: BacktestingCertificationEvidence = {
  certificationState: 'RESEARCH_REVIEW_REQUIRED',
  tradingEnabled: false,
  researchOnly: true,
  dataLicenseVerified: false,
  executionModelIndependentlyReviewed: false,
  regressionFixturesPassed: false,
  productionOwnerApproved: false,
};

/** Historical-research certification only. This function never authorizes trading. */
export function evaluateBacktestingCertification(
  evidence: Omit<BacktestingCertificationEvidence, 'certificationState' | 'tradingEnabled' | 'researchOnly'>,
): BacktestingCertificationEvidence {
  const researchCertified =
    evidence.dataLicenseVerified &&
    evidence.executionModelIndependentlyReviewed &&
    evidence.regressionFixturesPassed &&
    evidence.productionOwnerApproved;

  return {
    ...evidence,
    certificationState: researchCertified ? 'RESEARCH_CERTIFIED' : 'RESEARCH_REVIEW_REQUIRED',
    tradingEnabled: false,
    researchOnly: true,
  };
}
