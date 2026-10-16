"""Offline unit tests for the factory's pure pre-dispatch checks."""
from datetime import datetime, timezone, timedelta
import unittest

from factory.safety import FactorySafetyError, dependency_order, require_approval


class ApprovalTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 16, tzinfo=timezone.utc)
        self.approval = {
            "decision": "approved",
            "issue_id": "1425",
            "actor": "human:operator",
            "expires_at": (self.now + timedelta(hours=1)).isoformat(),
        }

    def test_valid_approval(self):
        require_approval(self.approval, issue_id="1425", now=self.now)

    def test_missing_approval(self):
        with self.assertRaises(FactorySafetyError):
            require_approval({}, issue_id="1425", now=self.now)

    def test_issue_mismatch(self):
        with self.assertRaises(FactorySafetyError):
            require_approval(self.approval, issue_id="other", now=self.now)

    def test_expired_approval(self):
        with self.assertRaises(FactorySafetyError):
            require_approval(self.approval, issue_id="1425", now=self.now + timedelta(hours=2))

    def test_agent_cannot_approve(self):
        self.approval["actor"] = "agent:builder"
        with self.assertRaises(FactorySafetyError):
            require_approval(self.approval, issue_id="1425", now=self.now)

    def test_naive_expiry_rejected(self):
        self.approval["expires_at"] = "2026-10-16T14:00:00"
        with self.assertRaises(FactorySafetyError):
            require_approval(self.approval, issue_id="1425", now=self.now)


class DependencyTests(unittest.TestCase):
    def test_dependency_first(self):
        self.assertEqual(dependency_order({"build": ["plan"], "plan": []}), ["plan", "build"])

    def test_unknown_dependency(self):
        with self.assertRaises(FactorySafetyError):
            dependency_order({"build": ["missing"]})

    def test_cycle(self):
        with self.assertRaises(FactorySafetyError):
            dependency_order({"a": ["b"], "b": ["a"]})

    def test_stable_order(self):
        self.assertEqual(dependency_order({"z": [], "a": []}), ["a", "z"])


if __name__ == "__main__":
    unittest.main()
