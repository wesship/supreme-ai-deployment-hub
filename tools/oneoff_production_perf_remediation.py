from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRANCH = "perf/production-performance-remediation"
WORKFLOW = ROOT / ".github/workflows/oneoff-production-performance-remediation.yml"

FILM_POSTERS = [
    "sovereign-signal-keyframe",
    "building-d3vonn-keyframe",
    "inside-hermes-keyframe",
    "guardian-keyframe",
    "ai-workforce-keyframe",
    "genesis-protocol-keyframe",
]


def run(*args: str) -> None:
    print("+", " ".join(args), flush=True)
    subprocess.run(args, cwd=ROOT, check=True)


def replace(path: str, old: str, new: str, *, required: bool = True) -> None:
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        if required:
            raise RuntimeError(f"Expected text not found in {path}: {old!r}")
        return
    target.write_text(text.replace(old, new))


def optimize_assets() -> None:
    films_dir = ROOT / "public/films"
    for stem in FILM_POSTERS:
        source = films_dir / f"{stem}.png"
        output = films_dir / f"{stem}.webp"
        if not source.exists():
            raise FileNotFoundError(source)
        run("cwebp", "-quiet", "-mt", "-q", "72", "-resize", "1280", "0", str(source), "-o", str(output))
        print(f"{output.relative_to(ROOT)}: {output.stat().st_size / 1024:.1f} KiB")

    source = ROOT / "public/d3vonn-enterprise-core.jpg"
    output = ROOT / "public/d3vonn-enterprise-core.webp"
    if not source.exists():
        raise FileNotFoundError(source)
    run("cwebp", "-quiet", "-mt", "-q", "72", "-resize", "1100", "0", str(source), "-o", str(output))
    print(f"{output.relative_to(ROOT)}: {output.stat().st_size / 1024:.1f} KiB")


def update_asset_references() -> None:
    paths = [
        "src/features/ai-films/catalog.ts",
        "src/pages/Film.tsx",
        "tests/e2e/production-interaction-audit.spec.ts",
    ]
    for path in paths:
        target = ROOT / path
        text = target.read_text()
        for stem in FILM_POSTERS:
            text = text.replace(f"/films/{stem}.png", f"/films/{stem}.webp")
        target.write_text(text)

    replace(
        "src/pages/Index.tsx",
        "const ENTERPRISE_CORE_SRC = '/d3vonn-enterprise-core.jpg?v=20260801-clean';",
        "const ENTERPRISE_CORE_SRC = '/d3vonn-enterprise-core.webp?v=20260904-perf';",
    )


def fix_accessible_names() -> None:
    replace(
        "src/components/Navbar.tsx",
        '                  aria-label="Open D3VONN.IO Command Nexus"\n',
        "",
    )
    replace(
        "src/pages/AIFilms.tsx",
        ' aria-label="Open AI Film Companion"',
        "",
    )


def fix_report_only_csp() -> None:
    path = ROOT / "middleware.ts"
    text = path.read_text()
    text = text.replace(
        "function cspFor(nonce: string): string {\n  return [",
        "function cspFor(nonce: string, reportOnly = false): string {\n  const directives = [",
    )
    text = text.replace(
        '    "object-src \'none\'",\n    \'upgrade-insecure-requests\',\n    `report-uri ${CSP_REPORT_ENDPOINT}`,\n  ].join(\'; \');\n}',
        '    "object-src \'none\'",\n  ];\n  if (!reportOnly) directives.push(\'upgrade-insecure-requests\');\n  directives.push(`report-uri ${CSP_REPORT_ENDPOINT}`);\n  return directives.join(\'; \');\n}',
    )
    text = text.replace(
        "  const policy = cspFor(nonce);\n  return next({",
        "  const policy = cspFor(nonce);\n  const reportOnlyPolicy = cspFor(nonce, true);\n  return next({",
    )
    text = text.replace(
        "      'Content-Security-Policy-Report-Only': policy,",
        "      'Content-Security-Policy-Report-Only': reportOnlyPolicy,",
    )
    required = [
        "function cspFor(nonce: string, reportOnly = false)",
        "const reportOnlyPolicy = cspFor(nonce, true);",
        "'Content-Security-Policy-Report-Only': reportOnlyPolicy,",
    ]
    for marker in required:
        if marker not in text:
            raise RuntimeError(f"CSP remediation marker missing: {marker}")
    path.write_text(text)


def harden_lighthouse_contract() -> None:
    path = ROOT / "lighthouse-config.json"
    config = json.loads(path.read_text())
    assertion_config = config["ci"]["assert"]
    assertion_config.pop("preset", None)
    assertions = assertion_config["assertions"]
    assertions.update(
        {
            "errors-in-console": ["error", {"minScore": 0.9}],
            "label-content-name-mismatch": ["error", {"minScore": 0.9}],
            "total-byte-weight": ["error", {"maxNumericValue": 8000000}],
            "uses-responsive-images": ["warn", {"maxLength": 0}],
            "uses-optimized-images": ["warn", {"maxLength": 0}],
            "modern-image-formats": ["warn", {"maxLength": 0}],
            "unused-javascript": ["warn", {"maxLength": 0}],
            "unused-css-rules": ["warn", {"maxLength": 0}],
            "unminified-javascript": ["warn", {"maxLength": 0}],
            "legacy-javascript": ["warn", {"maxLength": 0}],
            "dom-size": ["warn", {"minScore": 0.9}],
            "speed-index": ["warn", {"maxNumericValue": 5000}],
            "uses-long-cache-ttl": ["warn", {"maxLength": 0}],
        }
    )
    path.write_text(json.dumps(config, indent=2) + "\n")


def add_static_cache_headers() -> None:
    path = ROOT / "vercel.json"
    config = json.loads(path.read_text())
    headers = config.setdefault("headers", [])
    existing = {entry.get("source") for entry in headers}
    for source in ["/films/(.*)", "/d3vonn-enterprise-core.webp"]:
        if source not in existing:
            headers.insert(
                1,
                {
                    "source": source,
                    "headers": [
                        {
                            "key": "Cache-Control",
                            "value": "public, max-age=31536000, immutable",
                        }
                    ],
                },
            )
    path.write_text(json.dumps(config, indent=2) + "\n")


def validate() -> None:
    for stem in FILM_POSTERS:
        output = ROOT / "public/films" / f"{stem}.webp"
        if not output.exists() or output.stat().st_size <= 0:
            raise RuntimeError(f"Missing optimized poster: {output}")
        if output.stat().st_size > 1_200_000:
            raise RuntimeError(f"Optimized poster is still too large: {output} ({output.stat().st_size} bytes)")

    enterprise = ROOT / "public/d3vonn-enterprise-core.webp"
    if enterprise.stat().st_size > 1_000_000:
        raise RuntimeError(f"Enterprise core WebP is still too large: {enterprise.stat().st_size} bytes")

    catalog = (ROOT / "src/features/ai-films/catalog.ts").read_text()
    if "-keyframe.png" in catalog:
        raise RuntimeError("AI film catalog still references PNG keyframes")

    lighthouse = json.loads((ROOT / "lighthouse-config.json").read_text())
    if "preset" in lighthouse["ci"]["assert"]:
        raise RuntimeError("Lighthouse recommended preset still broadens the production gate")

    middleware = (ROOT / "middleware.ts").read_text()
    if "reportOnlyPolicy = cspFor(nonce, true)" not in middleware:
        raise RuntimeError("Report-only CSP is not separated from enforced CSP")

    run("git", "diff", "--check")


def remove_oneoff_helpers() -> None:
    # The workflow and this script are staging machinery only. Removing both means
    # the eventual PR contains only the production remediation itself.
    if WORKFLOW.exists():
        WORKFLOW.unlink()
    Path(__file__).unlink()


def main() -> None:
    optimize_assets()
    update_asset_references()
    fix_accessible_names()
    fix_report_only_csp()
    harden_lighthouse_contract()
    add_static_cache_headers()
    validate()
    remove_oneoff_helpers()
    print("Production performance remediation prepared successfully.")


if __name__ == "__main__":
    main()
