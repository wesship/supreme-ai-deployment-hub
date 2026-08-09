from pathlib import Path


def test_railway_image_packages_canonical_context():
    root = Path(__file__).resolve().parents[2]
    dockerfile = (root / "Dockerfile.railway").read_text(encoding="utf-8")
    railway = (root / "railway.json").read_text(encoding="utf-8")

    assert "COPY MASTER_CONTEXT.md ./MASTER_CONTEXT.md" in dockerfile
    assert '"MASTER_CONTEXT.md"' in railway
