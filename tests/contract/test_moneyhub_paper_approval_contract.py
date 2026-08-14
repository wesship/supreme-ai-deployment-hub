from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ENGINE = (ROOT / "backend/moneyhub/engine_router.py").read_text().lower()


def test_approval_threshold_blocks_simulated_execution():
    assert "risk.requires_approval" in ENGINE
    assert "requires approval before simulation" in ENGINE
    assert ENGINE.index("risk.requires_approval") < ENGINE.index("moneyhub_paper_execute_order")
