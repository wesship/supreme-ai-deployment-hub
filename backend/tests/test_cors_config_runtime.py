import os
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_main_keeps_d3vonn_origin_when_environment_overrides_origins() -> None:
    script = """
import os
os.environ['ALLOWED_ORIGINS'] = 'https://railway-preview.example.com'
from backend.main import ALLOWED_ORIGINS
assert 'https://d3vonn.io' in ALLOWED_ORIGINS, ALLOWED_ORIGINS
assert 'https://www.d3vonn.io' in ALLOWED_ORIGINS, ALLOWED_ORIGINS
assert 'https://app.d3vonn.io' in ALLOWED_ORIGINS, ALLOWED_ORIGINS
assert 'https://railway-preview.example.com' in ALLOWED_ORIGINS, ALLOWED_ORIGINS
"""
    env = os.environ.copy()
    env.pop("ALLOWED_ORIGINS", None)
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
