"""Static production-boundary checks for the Hermes release gate."""

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class HermesProductionGateTests(unittest.TestCase):
    def test_worker_control_tables_enable_rls(self) -> None:
        migration = (
            ROOT / "supabase/migrations/20260718_hermes_workers.sql"
        ).read_text(encoding="utf-8").lower()
        for table in ("hermes_workers", "hermes_worker_leases"):
            self.assertIn(
                f"alter table public.{table} enable row level security",
                migration,
            )

    def test_atomic_claim_rpc_is_service_role_only(self) -> None:
        migration = (
            ROOT
            / "supabase/migrations/20260901111149_hermes_capability_atomic_claim.sql"
        ).read_text(encoding="utf-8").lower()
        signature = "public.hermes_claim_capability_task(text, integer)"
        self.assertIn("security definer", migration)
        self.assertIn("set search_path = ''", migration)
        self.assertIn(f"revoke execute on function {signature}", migration)
        self.assertIn("from public, anon, authenticated", migration)
        self.assertIn(f"grant execute on function {signature}", migration)
        self.assertIn("to service_role", migration)

    def test_worker_requires_atomic_persistent_leases(self) -> None:
        worker = (ROOT / "backend/hermes/worker.py").read_text(encoding="utf-8")
        self.assertIn("HERMES_PERSISTENT_WORKERS_ENABLED must remain enabled", worker)
        self.assertIn("_renew_lease_until_stopped", worker)
        self.assertIn("await runtime.renew(lease.lease_id)", worker)

    def test_hermes_api_is_operator_protected(self) -> None:
        router = (ROOT / "backend/hermes/router.py").read_text(encoding="utf-8")
        self.assertIn("Depends(require_occ_access)", router)
        self.assertNotIn("ALLOW_DEV_ADMIN_BYPASS", router)

    def test_gate_is_not_a_placeholder(self) -> None:
        workflow = (
            ROOT / ".github/workflows/hermes-gate.yml"
        ).read_text(encoding="utf-8").lower()
        self.assertNotIn("manual review placeholder", workflow)
        self.assertIn("test_hermes_production_gate", workflow)
        self.assertIn("backend/tests/test_hermes_*.py", workflow)


if __name__ == "__main__":
    unittest.main()
