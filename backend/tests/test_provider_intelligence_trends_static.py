from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SERVICE = ROOT / "src/features/ai-films/providerIntelligenceService.ts"
WORKSPACE = ROOT / "src/features/ai-films/ProviderIntelligenceWorkspace.tsx"


def test_provider_intelligence_uses_bounded_time_windows_and_owner_rls():
    text = SERVICE.read_text()
    assert "windowDays: 7 | 30 | 90 = 30" in text
    assert ".eq('owner_id', authData.user.id)" in text
    assert ".gte('created_at', previousWindowStart)" in text
    assert "previousSampledJobs" in text
    assert ".limit(500)" in text


def test_cost_per_approved_shot_never_invents_missing_cost():
    text = SERVICE.read_text()
    assert "reportedCostPerApprovedShot" in text
    assert "reportedCostCoverageRate" in text
    assert "costs.length && approvedShots > 0 ? totalCost / approvedShots : null" in text
    assert "estimated_cost" in text
    assert "return null" in text


def test_workspace_exposes_windows_trends_and_cost_coverage():
    text = WORKSPACE.read_text()
    assert "[7, 30, 90].map" in text
    assert "passRateDelta" in text
    assert "failureRateDelta" in text
    assert "costPerApprovedShotDelta" in text
    assert "coverage {pct(provider.reportedCostCoverageRate)}" in text
    assert "Missing billing data is never estimated" in text


def test_routing_audit_correlates_same_job_outcome_without_recomputing_decision():
    service = SERVICE.read_text()
    workspace = WORKSPACE.read_text()
    assert "export type RoutingOutcomeEvidence" in service
    assert "outcome: routingOutcomeFromRow(row)" in service
    assert "result_asset_id" in service
    assert "latencySeconds: secondsBetween(row.started_at, row.completed_at)" in service
    assert "reportedCostUsd: reportedCost(asObject(row.cost_metadata))" in service
    assert "qaDecision" in service
    assert "regenerationCount" in service
    assert "Dispatch → outcome" in workspace
    assert "choice validated" in workspace
    assert "needs review" in workspace
    assert "outcome joined by render job" in workspace


def test_routing_outcome_keeps_missing_cost_and_pending_qa_explicit():
    service = SERVICE.read_text()
    workspace = WORKSPACE.read_text()
    assert "reportedCostUsd: number | null" in service
    assert "qaDecision: 'pass' | 'revise' | 'block' | null" in service
    assert "money(outcome.reportedCostUsd)" in workspace
    assert "outcome.qaDecision || 'pending'" in workspace
    assert "outcome.resultAssetId || 'not linked yet'" in workspace


def test_decision_quality_rollups_require_terminal_evidence_and_minimum_samples():
    service = SERVICE.read_text()
    assert "MIN_DECISION_QUALITY_SAMPLES = 3" in service
    assert "decisionOutcomeClass" in service
    assert "['failed', 'error'].includes(decision.outcome.status)" in service
    assert "return 'pending'" in service
    assert "evidenceSufficient: judged >= MIN_DECISION_QUALITY_SAMPLES" in service
    assert "evidenceCoverageRate" in service
    assert "reportedCostCoverageRate" in service


def test_decision_quality_segments_provider_and_style_without_changing_routing():
    service = SERVICE.read_text()
    workspace = WORKSPACE.read_text()
    assert "decisionQualitySnapshot(allRoutingDecisions)" in service
    assert "byProviderStyle" in service
    assert "providerStyles" in service
    assert "Did the top-ranked choice actually work?" in workspace
    assert "evidence sufficient" in workspace
    assert "sparse evidence" in workspace
    assert "Provider × style evidence" in workspace
    assert "These rollups are observational and do not change routing" in workspace
