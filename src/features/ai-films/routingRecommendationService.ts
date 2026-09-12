import type { DecisionQualityRollup, DecisionQualitySnapshot } from './providerIntelligenceService';

export type RoutingRecommendationAction = 'increase_preference' | 'decrease_preference' | 'hold';
export type RoutingRecommendationConfidence = 'low' | 'medium' | 'high';

export type RoutingRecommendation = {
  key: string;
  provider: string;
  styleId: string | null;
  action: RoutingRecommendationAction;
  proposedAdjustment: number;
  confidence: RoutingRecommendationConfidence;
  judgedSamples: number;
  evidenceCoverageRate: number;
  passRate: number;
  adverseRate: number;
  reportedCostUsdMean: number | null;
  reportedCostCoverageRate: number;
  rationale: string[];
  requiresHumanApproval: true;
  autoApply: false;
};

export type RoutingRecommendationSnapshot = {
  policy: {
    observationalOnly: true;
    minimumJudgedSamples: number;
    maxAbsoluteAdjustment: 5;
    humanApprovalRequired: true;
    autoApply: false;
  };
  recommendations: RoutingRecommendation[];
};

const confidenceFor = (rollup: DecisionQualityRollup): RoutingRecommendationConfidence => {
  if (rollup.judged >= 10 && rollup.evidenceCoverageRate >= 0.8) return 'high';
  if (rollup.judged >= 5 && rollup.evidenceCoverageRate >= 0.6) return 'medium';
  return 'low';
};

const recommendationFor = (rollup: DecisionQualityRollup): RoutingRecommendation | null => {
  if (!rollup.provider || !rollup.evidenceSufficient) return null;

  const adverseRate = rollup.reviseRate + rollup.blockRate + rollup.failureRate;
  let action: RoutingRecommendationAction = 'hold';
  let proposedAdjustment = 0;

  if (rollup.passRate >= 0.8 && adverseRate <= 0.2 && rollup.evidenceCoverageRate >= 0.75) {
    action = 'increase_preference';
    proposedAdjustment = 5;
  } else if (rollup.passRate >= 0.65 && adverseRate <= 0.35) {
    action = 'increase_preference';
    proposedAdjustment = 2;
  } else if (rollup.passRate <= 0.35 || rollup.blockRate + rollup.failureRate >= 0.4) {
    action = 'decrease_preference';
    proposedAdjustment = -5;
  } else if (rollup.passRate < 0.5 || adverseRate >= 0.5) {
    action = 'decrease_preference';
    proposedAdjustment = -2;
  }

  const rationale = [
    `${rollup.judged} judged outcomes from ${rollup.audited} audited choices`,
    `${Math.round(rollup.passRate * 100)}% pass rate`,
    `${Math.round(adverseRate * 100)}% revise/block/failure rate`,
    `${Math.round(rollup.evidenceCoverageRate * 100)}% terminal-outcome coverage`,
  ];
  if (rollup.reportedCostUsdMean !== null && rollup.reportedCostCoverageRate >= 0.75) {
    rationale.push(`provider-reported mean cost $${rollup.reportedCostUsdMean.toFixed(2)} with ${Math.round(rollup.reportedCostCoverageRate * 100)}% cost coverage`);
  } else {
    rationale.push(`cost evidence not used for the recommendation because coverage is below 75% or unavailable`);
  }

  return {
    key: rollup.key,
    provider: rollup.provider,
    styleId: rollup.styleId,
    action,
    proposedAdjustment: Math.max(-5, Math.min(5, proposedAdjustment)),
    confidence: confidenceFor(rollup),
    judgedSamples: rollup.judged,
    evidenceCoverageRate: rollup.evidenceCoverageRate,
    passRate: rollup.passRate,
    adverseRate,
    reportedCostUsdMean: rollup.reportedCostUsdMean,
    reportedCostCoverageRate: rollup.reportedCostCoverageRate,
    rationale,
    requiresHumanApproval: true,
    autoApply: false,
  };
};

export const buildRoutingRecommendations = (
  quality: DecisionQualitySnapshot,
): RoutingRecommendationSnapshot => {
  const styleRecommendations = quality.providerStyles
    .map(recommendationFor)
    .filter((item): item is RoutingRecommendation => Boolean(item));
  const styleProviders = new Set(styleRecommendations.map((item) => item.provider));
  const providerFallbacks = quality.providers
    .filter((rollup) => !styleProviders.has(String(rollup.provider || '')))
    .map(recommendationFor)
    .filter((item): item is RoutingRecommendation => Boolean(item));

  const recommendations = [...styleRecommendations, ...providerFallbacks]
    .sort((a, b) => {
      const confidenceRank = { high: 3, medium: 2, low: 1 };
      return confidenceRank[b.confidence] - confidenceRank[a.confidence]
        || b.judgedSamples - a.judgedSamples
        || Math.abs(b.proposedAdjustment) - Math.abs(a.proposedAdjustment)
        || a.key.localeCompare(b.key);
    });

  return {
    policy: {
      observationalOnly: true,
      minimumJudgedSamples: quality.minimumJudgedSamples,
      maxAbsoluteAdjustment: 5,
      humanApprovalRequired: true,
      autoApply: false,
    },
    recommendations,
  };
};
