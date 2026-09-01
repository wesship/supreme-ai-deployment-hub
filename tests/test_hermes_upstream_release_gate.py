import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "deploy/vps/scripts/update-hermes-upstream.sh"
ENV_EXAMPLE = ROOT / "deploy/vps/hermes-upstream.env.example"
WORKFLOW = ROOT / ".github/workflows/hermes-upstream-smoke.yml"


class HermesUpstreamReleaseGateTests(unittest.TestCase):
    def test_release_identity_is_consistent(self):
        expected = {
            "https://github.com/NousResearch/hermes-agent.git",
            "v2026.8.27",
            "5fc308a70719a83cccdbba4c0e39c23f5a8239d5",
            "0.20.6",
        }
        for path in (SCRIPT, ENV_EXAMPLE, WORKFLOW):
            text = path.read_text(encoding="utf-8")
            for value in expected:
                self.assertIn(value, text, f"{value} missing from {path}")

    def test_updater_is_locked_and_staging_only(self):
        text = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('repo" == "$TRUSTED_REPO', text)
        self.assertIn("uv sync", text)
        self.assertIn("--locked", text)
        self.assertIn('HERMES_HOME="$config_home"', text)
        self.assertIn('"$release_root/staged"', text)
        self.assertNotIn("uv pip install", text)
        self.assertNotIn("checkout --force", text)
        self.assertNotIn('"$release_root/current"', text)
        self.assertNotIn("systemctl", text)

    def test_workflow_actions_are_commit_pinned(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        for line in text.splitlines():
            if "uses:" in line:
                reference = line.split("uses:", 1)[1].split("#", 1)[0].strip()
                self.assertRegex(reference, r"@[0-9a-f]{40}$")


if __name__ == "__main__":
    unittest.main()
