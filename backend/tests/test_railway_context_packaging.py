import json
from fnmatch import fnmatchcase
from pathlib import Path


def test_railway_image_packages_canonical_context():
    root = Path(__file__).resolve().parents[2]
    dockerfile = (root / "Dockerfile.railway").read_text(encoding="utf-8")
    railway = (root / "railway.json").read_text(encoding="utf-8")

    assert "COPY MASTER_CONTEXT.md ./MASTER_CONTEXT.md" in dockerfile
    patterns = json.loads(railway)["build"]["watchPatterns"]
    assert any(fnmatchcase("MASTER_CONTEXT.md", pattern) for pattern in patterns)


def test_all_ai_films_runtime_images_install_and_verify_ffmpeg():
    root = Path(__file__).resolve().parents[2]
    dockerfiles = [
        root / "Dockerfile.railway",
        root / "Dockerfile.hermes-worker",
        root / "backend" / "Dockerfile",
    ]

    for dockerfile in dockerfiles:
        text = dockerfile.read_text(encoding="utf-8")
        assert "ffmpeg" in text
        assert "command -v ffmpeg" in text
        assert "command -v ffprobe" in text


def test_api_deploy_watch_covers_commits_requiring_same_sha_certification():
    root = Path(__file__).resolve().parents[2]
    railway = json.loads((root / "railway.json").read_text(encoding="utf-8"))
    patterns = railway["build"]["watchPatterns"]
    for path in (
        "src/pages/Index.tsx",
        "supabase/migrations/schema.sql",
        "docs/release.md",
        ".github/workflows/production-acceptance.yml",
    ):
        assert any(fnmatchcase(path, pattern) for pattern in patterns), path
