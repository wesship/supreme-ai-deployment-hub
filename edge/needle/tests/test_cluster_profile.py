import copy
import json
import unittest
from pathlib import Path

from edge.needle.validate_cluster_profile import validate

PROFILE = Path(__file__).parents[1] / "cluster-profile.json"


class ClusterProfileTests(unittest.TestCase):
    def setUp(self) -> None:
        self.profile = json.loads(PROFILE.read_text())

    def test_committed_profile_is_valid(self):
        self.assertEqual(validate(self.profile), [])

    def test_production_enablement_fails_closed(self):
        candidate = copy.deepcopy(self.profile)
        candidate["production_enabled"] = True
        self.assertIn("production_enabled must remain false", validate(candidate))

    def test_privileged_tool_cannot_be_moved_local(self):
        candidate = copy.deepcopy(self.profile)
        candidate["routing"]["local"].append("send_money")
        self.assertTrue(any("routing.local" in failure for failure in validate(candidate)))

    def test_recording_and_location_require_guardian(self):
        for action in ("start_recording", "stop_recording", "get_location"):
            candidate = copy.deepcopy(self.profile)
            candidate["routing"]["guardian_review"].remove(action)
            candidate["routing"]["local"].append(action)
            self.assertTrue(any("routing.local" in failure for failure in validate(candidate)))

    def test_offload_targets_fail_closed(self):
        for key in ("vision", "reasoning", "memory", "privileged_actions"):
            candidate = copy.deepcopy(self.profile)
            candidate["offload"][key] = "local"
            self.assertIn("offload must match approved cluster targets", validate(candidate))
        candidate = copy.deepcopy(self.profile)
        del candidate["offload"]
        self.assertIn("offload must match approved cluster targets", validate(candidate))

    def test_security_requirements_cannot_be_disabled(self):
        candidate = copy.deepcopy(self.profile)
        candidate["security"]["replay_protection_required"] = False
        self.assertIn("security.replay_protection_required must be true", validate(candidate))

    def test_secrets_must_not_be_baked_into_image(self):
        candidate = copy.deepcopy(self.profile)
        candidate["security"]["secrets_in_image"] = True
        self.assertIn("security.secrets_in_image must be false", validate(candidate))


if __name__ == "__main__":
    unittest.main()
