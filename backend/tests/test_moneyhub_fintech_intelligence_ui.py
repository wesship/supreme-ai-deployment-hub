from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "src" / "pages" / "MoneyHub.tsx"


def test_moneyhub_exposes_fintech_intelligence_surface():
    source = PAGE.read_text()
    assert "Hermes financial intelligence" in source
    assert "Fintech capability map" in source
    assert "30-day tracked earnings" in source
    assert "30-day run-rate" in source
    assert "Average per run" in source
    assert "Top-agent concentration" in source


def test_moneyhub_fintech_surface_preserves_governed_execution_boundary():
    source = PAGE.read_text()
    assert "without granting Hermes custody or autonomous transfer authority" in source
    assert "no signing or broadcasting" in source
    assert "no lending decision engine is active today" in source
    assert "Payments / lending providers" in source
    assert "Not connected" in source


def test_moneyhub_fintech_metrics_are_derived_from_existing_read_only_data():
    source = PAGE.read_text()
    assert "const last30d = earnings.reduce" in source
    assert "avgPerRun: runs > 0 ? tracked / runs : 0" in source
    assert "topAgentShare" in source
    assert "intelligenceSignals" in source
    assert ".from('agent_earnings').insert" not in source
    assert ".from('agent_earnings').update" not in source
    assert ".from('agent_earnings').delete" not in source
