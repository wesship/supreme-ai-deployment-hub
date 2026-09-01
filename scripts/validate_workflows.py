#!/usr/bin/env python3
"""Validate GitHub Actions workflow syntax and action references.

GitHub Actions expressions are normalized before parsing because they are valid
workflow syntax but not always scalar values that PyYAML can load directly.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

import yaml

WORKFLOW_DIR = Path(".github/workflows")
EXPRESSION_PATTERN = re.compile(r"\$\{\{.*?\}\}", re.DOTALL)
IF_PATTERN = re.compile(r"^(\s*if:\s*)(.*?)(\s*(?:#.*)?)$", re.MULTILINE)
SHA_PATTERN = re.compile(r"^[^@\s]+@[0-9a-f]{40}$")
DANGEROUS_REFS = {"main", "master", "HEAD"}
REQUIRED_GATE = WORKFLOW_DIR / "required-pr-gate.yml"


def normalize_github_syntax(content: str) -> str:
    """Replace GitHub expressions with safe YAML scalars before loading."""
    normalized_lines: list[str] = []
    lines = content.splitlines(keepends=True)
    index = 0
    while index < len(lines):
        line = lines[index]
        block_if = re.match(r"^(\s*)if:\s*[>|][+-]?\s*(?:#.*)?$", line)
        if not block_if:
            normalized_lines.append(line)
            index += 1
            continue

        indent = len(block_if.group(1))
        normalized_lines.append(f'{block_if.group(1)}if: "GITHUB_CONDITION"\n')
        index += 1
        while index < len(lines):
            candidate = lines[index]
            stripped = candidate.strip()
            candidate_indent = len(candidate) - len(candidate.lstrip())
            if stripped and candidate_indent <= indent:
                break
            index += 1

    content = "".join(normalized_lines)
    content = EXPRESSION_PATTERN.sub("GITHUB_EXPRESSION", content)

    def replace_if(match: re.Match[str]) -> str:
        prefix, value, suffix = match.groups()
        stripped = value.strip()
        if not stripped or stripped[0] in {"'", '"'}:
            return match.group(0)
        return f'{prefix}"GITHUB_CONDITION"{suffix}'

    return IF_PATTERN.sub(replace_if, content)


def workflow_files() -> list[Path]:
    return sorted({*WORKFLOW_DIR.glob("*.yml"), *WORKFLOW_DIR.glob("*.yaml")})


def load_workflow(path: Path) -> dict[str, Any]:
    parsed = yaml.safe_load(normalize_github_syntax(path.read_text(encoding="utf-8")))
    if parsed is None:
        return {}
    if not isinstance(parsed, dict):
        raise yaml.YAMLError("workflow root must be a mapping")
    return parsed


def collect_uses(value: Any, found: list[str]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "uses" and isinstance(child, str):
                found.append(child)
            else:
                collect_uses(child, found)
    elif isinstance(value, list):
        for child in value:
            collect_uses(child, found)


def validate_yaml(files: list[Path]) -> list[str]:
    errors: list[str] = []
    for workflow in files:
        try:
            load_workflow(workflow)
        except yaml.YAMLError as error:
            errors.append(f"{workflow}: {error}")
    return errors


def validate_action_references(files: list[Path]) -> list[str]:
    errors: list[str] = []
    for workflow in files:
        try:
            parsed = load_workflow(workflow)
        except yaml.YAMLError as error:
            errors.append(f"{workflow}: cannot validate action references: {error}")
            continue

        references: list[str] = []
        collect_uses(parsed, references)
        for reference in references:
            if reference.startswith(("./", "docker://")):
                continue
            if "@" not in reference:
                errors.append(f"{workflow}: external action has no ref: {reference}")
                continue

            ref = reference.rsplit("@", 1)[1]
            if ref in DANGEROUS_REFS:
                errors.append(f"{workflow}: mutable action ref is not allowed: {reference}")
            if workflow == REQUIRED_GATE and not SHA_PATTERN.fullmatch(reference):
                errors.append(
                    f"{workflow}: required-gate action is not pinned to a full SHA: {reference}"
                )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode",
        choices=("all", "yaml", "actions"),
        default="all",
        help="validation group to run (default: all)",
    )
    args = parser.parse_args()

    if not WORKFLOW_DIR.is_dir():
        print(f"::error::workflow directory not found: {WORKFLOW_DIR}")
        return 2

    files = workflow_files()
    errors: list[str] = []
    if args.mode in {"all", "yaml"}:
        errors.extend(validate_yaml(files))
    if args.mode in {"all", "actions"}:
        errors.extend(validate_action_references(files))

    if errors:
        for error in errors:
            print(f"::error::{error}")
        return 1

    checks = []
    if args.mode in {"all", "yaml"}:
        checks.append("YAML structure")
    if args.mode in {"all", "actions"}:
        checks.append("action references")
    print(f"All {len(files)} workflow files passed {', '.join(checks)} validation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
