from datetime import datetime, timedelta, timezone
import unittest

from factory.approval_binding import authorize_dispatch, scope_fingerprint
from factory.safety import FactorySafetyError


class ApprovalBindingTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 16, tzinfo=timezone.utc)
        self.params = dict(issue_id="1425", repository="wesship/supreme-ai-deployment-hub",
                           commit_sha="a" * 40, operation="draft-pr")
        self.record = {
            "decision": "approved", "issue_id": "1425", "actor": "human:operator",
            "expires_at": (self.now + timedelta(hours=1)).isoformat(),
            "scope_fingerprint": scope_fingerprint(**self.params),
        }

    def check(self, verifier):
        authorize_dispatch(self.record, **self.params, trusted_verifier=verifier, now=self.now)

    def test_verified_approval(self):
        self.check(lambda _: True)

    def test_unverified_identity(self):
        with self.assertRaises(FactorySafetyError):
            self.check(lambda _: False)

    def test_verifier_failure_is_denied(self):
        def unavailable(_):
            raise ConnectionError("identity provider unavailable")
        with self.assertRaises(FactorySafetyError):
            self.check(unavailable)

    def test_missing_verifier_is_denied(self):
        with self.assertRaises(FactorySafetyError):
            self.check(None)

    def test_scope_mutation_is_denied(self):
        self.params["operation"] = "deploy"
        with self.assertRaises(FactorySafetyError):
            self.check(lambda _: True)

    def test_expired_approval_is_denied(self):
        self.record["expires_at"] = (self.now - timedelta(seconds=1)).isoformat()
        with self.assertRaises(FactorySafetyError):
            self.check(lambda _: True)


if __name__ == "__main__":
    unittest.main()
