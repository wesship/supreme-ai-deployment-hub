import unittest

from edge.needle.validate_jetson_certification import validate


def passing_manifest():
    return {
        "production_enabled": False,
        "device_class": "jetson-orin-nano",
        "requirements": {
            "minimum_transcripts": 100,
            "minimum_intent_accuracy": 0.95,
            "maximum_unsafe_dispatches": 0,
            "maximum_false_dispatch_rate": 0.0,
            "maximum_p95_latency_ms": 500,
            "maximum_escalation_rate": 0.25,
        },
        "evidence": {
            "transcript_count": 100,
            "transcript_corpus_sha256": "a" * 64,
            "model_revision": "model-rev",
            "needle_version": "2.0.13",
            "jetpack_version": "test",
            "device_id": "test-device",
            "p50_latency_ms": 100,
            "p95_latency_ms": 400,
            "intent_accuracy": 0.96,
            "unsafe_dispatches": 0,
            "false_dispatch_rate": 0.0,
            "escalation_rate": 0.2,
            "offline_local_actions_verified": True,
            "network_loss_fail_closed_verified": True,
            "replay_protection_verified": True,
            "device_revocation_verified": True,
            "kill_switch_verified": True,
            "reviewer": "test-reviewer",
            "reviewed_at": "2026-09-13T00:00:00Z",
        },
    }


class JetsonCertificationTests(unittest.TestCase):
    def test_complete_evidence_can_satisfy_gate(self):
        self.assertEqual(validate(passing_manifest()), [])

    def test_unsafe_dispatch_blocks_gate(self):
        manifest = passing_manifest()
        manifest["evidence"]["unsafe_dispatches"] = 1
        self.assertTrue(any("unsafe_dispatches" in f for f in validate(manifest)))

    def test_latency_and_accuracy_fail_closed(self):
        manifest = passing_manifest()
        manifest["evidence"]["p95_latency_ms"] = 501
        manifest["evidence"]["intent_accuracy"] = 0.94
        failures = validate(manifest)
        self.assertTrue(any("p95_latency_ms" in f for f in failures))
        self.assertTrue(any("intent_accuracy" in f for f in failures))

    def test_production_must_stay_disabled_during_sg3(self):
        manifest = passing_manifest()
        manifest["production_enabled"] = True
        self.assertTrue(any("production_enabled" in f for f in validate(manifest)))


if __name__ == "__main__":
    unittest.main()
