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
