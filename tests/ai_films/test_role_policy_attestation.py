import os
import unittest
from unittest.mock import patch

from backend.ai_films.role_policy_attestation import (
    InvalidAttestation, issue_policy_attestation, verify_policy_attestation,
)
from backend.ai_films.role_runtime import RoleProfileUnavailable

SECRET = "only-for-local-tests-please-do-not-use-in-production"
PROJECT = "fa6b7a0a-c3a8-4df5-bae3-079d03e64b0e"
PROFILE = {"avatar_version": "avatar-v1", "voice_version": "voice-v1", "introduction": "Welcome",
           "sources": ["lesson:approved"], "tools": ["lesson_search"],
           "memory_scope": "session", "handoff": "Ask a human"}


class PolicyAttestationTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"AI_FILMS_ROLE_ATTESTATION_SECRET": SECRET})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_binds_exact_project_role_revision_and_profile(self):
        token = issue_policy_attestation(PROJECT, "teacher", 3, PROFILE, at=1000)
        self.assertEqual(verify_policy_attestation(token, PROJECT, "teacher", 3, PROFILE, at=1100)["test_type"], "policy_v1")
        altered = {**PROFILE, "voice_version": "voice-v2"}
        for project, role, revision, profile in (("other", "teacher", 3, PROFILE),
                                                  (PROJECT, "host", 3, PROFILE),
                                                  (PROJECT, "teacher", 4, PROFILE),
                                                  (PROJECT, "teacher", 3, altered)):
            with self.subTest(project=project, role=role, revision=revision), self.assertRaises(InvalidAttestation):
                verify_policy_attestation(token, project, role, revision, profile, at=1100)

    def test_tamper_expiry_and_unconfigured_secret_fail_closed(self):
        token = issue_policy_attestation(PROJECT, "teacher", 1, PROFILE, at=1000)
        with self.assertRaises(InvalidAttestation):
            verify_policy_attestation(token[:-1] + ("A" if token[-1] != "A" else "B"), PROJECT, "teacher", 1, PROFILE, at=1100)
        with self.assertRaises(InvalidAttestation):
            verify_policy_attestation("é." + token.split(".")[1], PROJECT, "teacher", 1, PROFILE, at=1100)
        with self.assertRaises(InvalidAttestation):
            verify_policy_attestation(token, PROJECT, "teacher", 1, PROFILE, at=1601)
        with patch.dict(os.environ, {"AI_FILMS_ROLE_ATTESTATION_SECRET": "short"}):
            with self.assertRaises(RuntimeError):
                issue_policy_attestation(PROJECT, "teacher", 1, PROFILE, at=1000)

    def test_locked_role_and_tool_crossing_do_not_get_attestation(self):
        with self.assertRaises(RoleProfileUnavailable):
            issue_policy_attestation(PROJECT, "mental_health", 1, PROFILE)
        with self.assertRaises(RoleProfileUnavailable):
            issue_policy_attestation(PROJECT, "teacher", 1, {**PROFILE, "tools": ["cleared_catalog"]})


if __name__ == "__main__":
    unittest.main()
