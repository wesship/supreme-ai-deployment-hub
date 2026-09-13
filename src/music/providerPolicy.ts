export type ProviderApproval = {
  status: 'pending' | 'approved' | 'rejected';
  reviewer: string | null;
  reviewed_at: string | null;
};

export type ProviderPolicyRecord = {
  id: string;
  source_revision: string;
  model_revision: string;
  weights_sha256: string;
  hosted_allowed: boolean;
  commercial_generation_allowed: boolean;
  commercial_output_allowed: boolean;
  enabled: boolean;
  provenance_required: boolean;
  approval: ProviderApproval;
};

export type ProviderPolicyResult = {
  allowed: boolean;
  reasons: string[];
};

const isPinned = (value: string) => value.length > 0 && value !== 'UNPINNED';

export function evaluateProviderPolicy(provider: ProviderPolicyRecord): ProviderPolicyResult {
  const reasons: string[] = [];

  if (!isPinned(provider.source_revision)) reasons.push('source_revision_unpinned');
  if (!isPinned(provider.model_revision)) reasons.push('model_revision_unpinned');
  if (!isPinned(provider.weights_sha256)) reasons.push('weights_hash_unpinned');
  if (provider.provenance_required !== true) reasons.push('provenance_not_required');
  if (provider.approval.status !== 'approved') reasons.push('approval_missing');
  if (!provider.approval.reviewer || !provider.approval.reviewed_at) reasons.push('approval_metadata_missing');
  if (provider.hosted_allowed !== true) reasons.push('hosted_dispatch_disabled');
  if (provider.commercial_generation_allowed !== true) reasons.push('commercial_generation_disabled');
  if (provider.commercial_output_allowed !== true) reasons.push('commercial_output_disabled');
  if (provider.enabled !== true) reasons.push('provider_disabled');

  return { allowed: reasons.length === 0, reasons };
}

export function createProviderPolicySnapshot(provider: ProviderPolicyRecord) {
  return Object.freeze({
    provider_id: provider.id,
    source_revision: provider.source_revision,
    model_revision: provider.model_revision,
    weights_sha256: provider.weights_sha256,
    approval: { ...provider.approval },
    captured_at: new Date().toISOString(),
  });
}
