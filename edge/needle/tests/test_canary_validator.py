import unittest

from edge.needle.canary_validator import validate_canary


class CanaryValidatorTests(unittest.TestCase):
    def base_policy(self):
        return {
            "production_enabled": False,
            "cohort": {"mode": "explicit_device_allowlist", "device_ids": ["jetson-orin-001"]},
            "allowed_actions": ["get_battery", "capture_photo", "describe_scene", "read_text", "create_note", "ask_d3vonn", "recall_memory"],
            "guardian_only_actions": ["start_recording", "stop_recording", "get_location", "delete_data", "send_money"],
            "activation_requirements": {
                "sg3_status": "PASS",
                "minimum_canary_hours": 24,
                "maximum_unsafe_dispatches": 0,
                "maximum_false_dispatch_rate": 0.0,
                "maximum_error_rate": 0.02,
                "maximum_p95_latency_ms": 750,
                "rollback_test_verified": True,
                "kill_switch_test_verified": True,
                "human_reviewer_required": True,
            },
        }

    def passing_evidence(self):
        return {
            "canary_hours": 24,
            "unsafe_dispatches": 0,
            "false_dispatch_rate": 0.0,
            "error_rate": 0.01,
            "p95_latency_ms": 500,
            "rollback_test_verified": True,
            "kill_switch_test_verified": True,
            "reviewer": "safety-reviewer",
            "reviewed_at": "2026-09-13T16:00:00Z",
            "observed_actions": ["get_battery", "read_text"],
        }

    def test_passes_only_after_sg3_and_complete_canary_evidence(self):
        result = validate_canary(policy=self.base_policy(), sg3={"status": "PASS"}, evidence=self.passing_evidence())
        self.assertEqual(result.status, "PASS")
        self.assertEqual(result.failures, ())

    def test_blocks_without_sg3_pass(self):
        result = validate_canary(policy=self.base_policy(), sg3={"status": "PENDING_HARDWARE_EVIDENCE"}, evidence=self.passing_evidence())
        self.assertEqual(result.status, "BLOCKED")
        self.assertIn("SG-3 hardware certification has not passed", result.failures)

    def test_blocks_empty_device_allowlist(self):
        policy = self.base_policy()
        policy["cohort"]["device_ids"] = []
        result = validate_canary(policy=policy, sg3={"status": "PASS"}, evidence=self.passing_evidence())
        self.assertEqual(result.status, "BLOCKED")

    def test_blocks_guardian_action_in_canary_evidence(self):
        evidence = self.passing_evidence()
        evidence["observed_actions"] = ["get_location"]
        result = validate_canary(policy=self.base_policy(), sg3={"status": "PASS"}, evidence=evidence)
        self.assertEqual(result.status, "BLOCKED")
        self.assertIn("canary evidence contains action outside low-risk allowlist", result.failures)

    def test_blocks_unsafe_dispatch_or_missing_reviewer(self):
        evidence = self.passing_evidence()
        evidence["unsafe_dispatches"] = 1
        evidence["reviewer"] = None
        result = validate_canary(policy=self.base_policy(), sg3={"status": "PASS"}, evidence=evidence)
        self.assertEqual(result.status, "BLOCKED")
        self.assertIn("unsafe dispatch detected or evidence missing", result.failures)
        self.assertIn("human reviewer evidence is required", result.failures)


if __name__ == "__main__":
    unittest.main()
