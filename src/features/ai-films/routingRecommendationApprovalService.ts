import { supabase } from '@/integrations/supabase/client';
import type { RoutingRecommendation } from './routingRecommendationService';

export type RoutingRecommendationDecision = 'approved' | 'rejected';

export type RoutingRecommendationApproval = {
  id: string;
  recommendationKey: string;
  provider: string;
  styleId: string | null;
  decision: RoutingRecommendationDecision;
  rationale: string;
  evidenceHash: string;
  evidence: Record<string, unknown>;
  reviewerId: string;
  decidedAt: string;
};

export const routingRecommendationEvidence = (recommendation: RoutingRecommendation): Record<string, unknown> => ({
  schema: 'd3vonn.ai-films.routing-recommendation-evidence/v1',
  key: recommendation.key,
  provider: recommendation.provider,
  styleId: recommendation.styleId,
  action: recommendation.action,
  proposedAdjustment: recommendation.proposedAdjustment,
  confidence: recommendation.confidence,
  judgedSamples: recommendation.judgedSamples,
  evidenceCoverageRate: recommendation.evidenceCoverageRate,
  passRate: recommendation.passRate,
  adverseRate: recommendation.adverseRate,
  reportedCostUsdMean: recommendation.reportedCostUsdMean,
  reportedCostCoverageRate: recommendation.reportedCostCoverageRate,
  rationale: recommendation.rationale,
});

export const approvalMatchesRecommendation = (
  approval: RoutingRecommendationApproval,
  recommendation: RoutingRecommendation,
): boolean => JSON.stringify(approval.evidence) === JSON.stringify(routingRecommendationEvidence(recommendation));

export const fetchRoutingRecommendationApprovals = async (projectId?: string): Promise<RoutingRecommendationApproval[]> => {
  let query = (supabase as any)
    .from('ai_film_routing_recommendation_approvals')
    .select('id,recommendation_key,provider,style_id,decision,rationale,evidence_hash,evidence,reviewer_id,decided_at')
    .order('decided_at', { ascending: false })
    .limit(100);
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: String(row.id),
    recommendationKey: String(row.recommendation_key),
    provider: String(row.provider),
    styleId: row.style_id ? String(row.style_id) : null,
    decision: String(row.decision) as RoutingRecommendationDecision,
    rationale: String(row.rationale || ''),
    evidenceHash: String(row.evidence_hash || ''),
    evidence: row.evidence && typeof row.evidence === 'object' ? row.evidence as Record<string, unknown> : {},
    reviewerId: String(row.reviewer_id),
    decidedAt: String(row.decided_at),
  }));
};

export const recordRoutingRecommendationDecision = async ({
  projectId,
  recommendation,
  decision,
  rationale,
}: {
  projectId?: string;
  recommendation: RoutingRecommendation;
  decision: RoutingRecommendationDecision;
  rationale: string;
}): Promise<void> => {
  const trimmed = rationale.trim();
  if (trimmed.length < 3) throw new Error('Add a short rationale before recording this decision.');
  if (trimmed.length > 2000) throw new Error('Approval rationale must be 2,000 characters or fewer.');

  const { error } = await (supabase as any)
    .from('ai_film_routing_recommendation_approvals')
    .insert({
      project_id: projectId || null,
      recommendation_key: recommendation.key,
      provider: recommendation.provider,
      style_id: recommendation.styleId,
      recommendation_action: recommendation.action,
      proposed_adjustment: recommendation.proposedAdjustment,
      confidence: recommendation.confidence,
      decision,
      rationale: trimmed,
      evidence: routingRecommendationEvidence(recommendation),
    });
  if (error) {
    if (String(error.code || '') === '23505') throw new Error('This exact recommendation evidence has already been decided.');
    throw error;
  }
};
