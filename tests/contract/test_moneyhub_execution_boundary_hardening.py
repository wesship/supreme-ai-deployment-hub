from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HARDENING = (
    ROOT
    / "supabase/migrations/20260811234000_moneyhub_execution_boundary_hardening.sql"
).read_text().lower()


def test_rpc_revalidates_owner_run_strategy_consistency():
    assert "where id = p_order_id and owner_id = p_owner_id" in HARDENING
    assert "where id = v_order.run_id and owner_id = p_owner_id" in HARDENING
    assert "v_run.strategy_id <> v_order.strategy_id" in HARDENING
    assert "where id = v_order.strategy_id and owner_id = p_owner_id" in HARDENING
    assert "paper position ownership or strategy mismatch" in HARDENING


def test_rpc_rejects_unsafe_simulation_inputs():
    assert "slippage_bps must be between 0 and 1000" in HARDENING
    assert "simulated fill price must be > 0" in HARDENING
    assert "fee cannot be negative" in HARDENING
    assert "quote price must be > 0" in HARDENING


def test_rpc_remains_service_role_only_and_simulation_only():
    assert "from public, anon, authenticated" in HARDENING
    assert "to service_role" in HARDENING
    assert "'mode','simulation_only'" in HARDENING
