from datetime import datetime, timedelta, timezone
import unittest

from factory.approval_binding import scope_fingerprint
from factory.dispatch import plan_dispatch
from factory.safety import FactorySafetyError


class DispatchTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 16, tzinfo=timezone.utc)
        self.scope = dict(issue_id="1425", repository="wesship/supreme-ai-deployment-hub",
                          commit_sha="a" * 40, operation="draft-pr")
        self.approval = dict(
            decision="approved", issue_id="1425", actor="human:operator",
            expires_at=(self.now + timedelta(hours=1)).isoformat(),
            scope_fingerprint=scope_fingerprint(**self.scope),
        )
        self.args = dict(
            **self.scope, approval=self.approval, trusted_verifier=lambda _: True,
            dependency_graph={"1424": [], "1425": ["1424"]},
            completed_issues=frozenset({"1424"}), now=self.now,
        )

    def test_stable_task_id(self):
        a = plan_dispatch(**self.args)
        b = plan_dispatch(**self.args)
        self.assertEqual(a, b)
        self.assertTrue(a.task_id.startswith("factory-"))

    def test_unmet_dependency_denied(self):
        self.args["completed_issues"] = frozenset()
        with self.assertRaises(FactorySafetyError):
            plan_dispatch(**self.args)

    def test_incomplete_transitive_dependency_denied(self):
        self.args["dependency_graph"] = {
            "foundation": [], "1424": ["foundation"], "1425": ["1424"],
        }
        with self.assertRaises(FactorySafetyError):
            plan_dispatch(**self.args)

    def test_complete_transitive_dependencies_allowed(self):
        self.args["dependency_graph"] = {
            "foundation": [], "1424": ["foundation"], "1425": ["1424"],
            "unrelated": [],
        }
        self.args["completed_issues"] = frozenset({"foundation", "1424"})
        self.assertEqual(plan_dispatch(**self.args).issue_id, "1425")

    def test_shared_ancestor_checked_across_branches(self):
        self.args["dependency_graph"] = {
            "root": [], "left": ["root"], "right": ["root"],
            "1425": ["left", "right"],
        }
        self.args["completed_issues"] = frozenset({"left", "right"})
        with self.assertRaises(FactorySafetyError):
            plan_dispatch(**self.args)

    def test_dependency_denial_does_not_call_verifier(self):
        calls = []
        self.args["trusted_verifier"] = lambda record: calls.append(record) or True
        self.args["completed_issues"] = frozenset()
        with self.assertRaises(FactorySafetyError):
            plan_dispatch(**self.args)
        self.assertEqual(calls, [])

    def test_unknown_issue_denied(self):
        self.args["dependency_graph"] = {"1424": []}
        with self.assertRaises(FactorySafetyError):
            plan_dispatch(**self.args)

    def test_cycle_denied(self):
        self.args["dependency_graph"] = {"1424": ["1425"], "1425": ["1424"]}
        with self.assertRaises(FactorySafetyError):
            plan_dispatch(**self.args)

    def test_verifier_denial(self):
        self.args["trusted_verifier"] = lambda _: False
        with self.assertRaises(FactorySafetyError):
            plan_dispatch(**self.args)

    def test_scope_change_denied(self):
        self.args["operation"] = "deploy"
        with self.assertRaises(FactorySafetyError):
            plan_dispatch(**self.args)


if __name__ == "__main__":
    unittest.main()
