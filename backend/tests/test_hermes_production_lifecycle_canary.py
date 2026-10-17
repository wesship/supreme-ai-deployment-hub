"""Offline regression tests for the production Hermes lifecycle certification canary."""
import os
import runpy
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "hermes" / "production_lifecycle_canary.py"


class HermesCanaryCertificationTests(unittest.TestCase):
    def setUp(self):
        with patch.dict(os.environ, {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "offline-test-only",
            "CERTIFIED_SHA": "certified-sha",
        }):
            self.canary = runpy.run_path(str(SCRIPT), run_name="hermes_canary_tests")

    def test_rejects_naive_timestamp(self):
        with self.assertRaisesRegex(ValueError, "timezone"):
            self.canary["_parse_timestamp"]("2026-10-16T12:00:00")

    def test_accepts_utc_timestamp(self):
        result = self.canary["_parse_timestamp"]("2026-10-16T12:00:00Z")
        self.assertEqual(result.utcoffset().total_seconds(), 0)

    def test_rejects_invalid_identity_payload(self):
        request = self.canary["verify_api_health"].__globals__
        with patch.dict(request, {"_json_request": lambda url, **kwargs: None}):
            with self.assertRaisesRegex(RuntimeError, "commit does not match"):
                self.canary["verify_api_health"]()

    def test_rejects_mismatched_lease_task(self):
        ns = self.canary["wait_for_completion"].__globals__
        fake_task = {"task": {"id": "task-1", "status": "COMPLETED", "assigned_to": "worker-1"}}
        fake_leases = [{"lease_id": "l-1", "task_id": "task-2", "worker_id": "worker-1", "status": "released"}]
        with patch.dict(ns, {
            "_json_request": lambda *args, **kwargs: fake_task,
            "_table_get": lambda *args, **kwargs: fake_leases,
        }):
            with self.assertRaisesRegex(RuntimeError, "another task"):
                self.canary["wait_for_completion"]("task-1")

    def test_rejects_mismatched_lease_worker(self):
        ns = self.canary["wait_for_completion"].__globals__
        fake_task = {"task": {"id": "task-1", "status": "COMPLETED", "assigned_to": "worker-1"}}
        fake_leases = [{"lease_id": "l-1", "task_id": "task-1", "worker_id": "worker-2", "status": "released"}]
        with patch.dict(ns, {
            "_json_request": lambda *args, **kwargs: fake_task,
            "_table_get": lambda *args, **kwargs: fake_leases,
        }):
            with self.assertRaisesRegex(RuntimeError, "different workers"):
                self.canary["wait_for_completion"]("task-1")


if __name__ == "__main__":
    unittest.main()
