import json
import os
import re
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_vercel_health_route_precedes_spa_fallback():
    config = json.loads((ROOT / "vercel.json").read_text())
    rewrites = config["rewrites"]
    health_index = next(i for i, item in enumerate(rewrites) if item.get("source") == "/health")
    fallback_index = next(i for i, item in enumerate(rewrites) if item.get("source") == "/(.*)")
    assert health_index < fallback_index
    assert rewrites[health_index]["destination"] == "/health.json"


def test_health_payload_is_machine_readable():
    payload = json.loads((ROOT / "public" / "health.json").read_text())
    sha = payload.pop("commit_sha", None)
    if sha is not None:
        assert re.fullmatch(r"[0-9a-f]{40}", sha)
    assert payload == {
        "ok": True,
        "service": "d3vonn-web",
        "environment": "production",
        "status": "healthy",
    }


def test_generated_health_certifies_build_commit(tmp_path):
    sha = "a" * 40
    subprocess.run(["node", str(ROOT / "scripts/generate-public-assets.mjs")],
                   cwd=tmp_path, env={**os.environ, "VERCEL_GIT_COMMIT_SHA": sha}, check=True)
    payload = json.loads((tmp_path / "public/health.json").read_text())
    assert payload["commit_sha"] == sha


def test_source_archive_without_git_keeps_revision_unknown(tmp_path):
    node = shutil.which("node")
    env = {**os.environ, "PATH": str(tmp_path), "VERCEL_GIT_COMMIT_SHA": "", "GITHUB_SHA": ""}
    subprocess.run([node, str(ROOT / "scripts/generate-public-assets.mjs")],
                   cwd=tmp_path, env=env, check=True)
    payload = json.loads((tmp_path / "public/health.json").read_text())
    assert payload["commit_sha"] is None
