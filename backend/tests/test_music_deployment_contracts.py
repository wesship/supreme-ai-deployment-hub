"""Static contracts for Music Studio deployment and persistence controls."""
from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class MusicDeploymentContractTests(unittest.TestCase):
    def test_cloud_provider_is_private_and_starts_disabled(self) -> None:
        manifest = (ROOT / "deployment/music/kubernetes/ace-step-private-gpu.yaml").read_text()

        self.assertIn("kind: Deployment", manifest)
        self.assertIn("replicas: 0", manifest)
        self.assertIn("kind: Service", manifest)
        self.assertIn("type: ClusterIP", manifest)
        self.assertIn("nvidia.com/gpu: \"1\"", manifest)
        self.assertNotIn("kind: Ingress", manifest)

    def test_music_schema_contains_policy_and_lifecycle_gates(self) -> None:
        migration = (ROOT / "supabase/migrations/20260820110000_music_generator_ace_step.sql").read_text()
        for lifecycle_status in ("queued", "provisioning", "running", "post_processing", "uploading", "succeeded", "failed", "cancelled", "retrying"):
            self.assertIn(f"'{lifecycle_status}'", migration)
        for policy_field in ("commercial_allowed", "hosted_allowed", "output_commercial_allowed", "license_review_status"):
            self.assertIn(policy_field, migration)
        self.assertIn("music_claim_generation_jobs", migration)
        self.assertIn("for update skip locked", migration.lower())


if __name__ == "__main__":
    unittest.main()
