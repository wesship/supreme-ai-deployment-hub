#!/usr/bin/env python3
"""Repository secret-pattern scanner for CI.

This is intentionally conservative: it blocks high-confidence token shapes while
allowing documented placeholders and examples.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

PATTERNS = {
    "openai_or_generic_sk": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    "anthropic_key": re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b"),
    "aws_access_key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "github_token": re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{30,}\b"),
    "pinecone_key": re.compile(r"\bpcsk_[A-Za-z0-9_-]{20,}\b"),
    "jwt": re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
}

SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".vercel",
    ".turbo",
    "coverage",
    "benchmark-artifacts",
}

SKIP_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz",
    ".woff", ".woff2", ".ttf", ".mp4", ".mov", ".lock",
}

ALLOWLIST_FRAGMENTS = (
    "sk-REPLACE_ME",
    "sk-your",
    "sk_test_",
    "example",
    "placeholder",
)


def should_skip(path: Path) -> bool:
    parts = set(path.parts)
    if parts & SKIP_DIRS:
        return True
    return path.suffix.lower() in SKIP_SUFFIXES


def scan_file(path: Path) -> list[str]:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return []
    findings: list[str] = []
    for idx, line in enumerate(text.splitlines(), start=1):
        lowered = line.lower()
        if any(fragment.lower() in lowered for fragment in ALLOWLIST_FRAGMENTS):
            continue
        for name, pattern in PATTERNS.items():
            if pattern.search(line):
                findings.append(f"{path}:{idx}: potential {name}")
    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", nargs="?", default=".")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    findings: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for filename in filenames:
            path = Path(dirpath) / filename
            if should_skip(path):
                continue
            findings.extend(scan_file(path))
    if findings:
        print("Secret scan failed:")
        for finding in findings:
            print(f"  - {finding}")
        return 1
    print("Secret scan passed: no high-confidence secret patterns found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
