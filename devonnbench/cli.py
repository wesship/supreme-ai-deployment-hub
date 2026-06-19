"""
DevonnBench v1 — CLI

Usage:
    devonnbench run suites/smoke.yaml --base-url https://api.devonn.ai --env staging
    devonnbench run suites/smoke.yaml --base-url http://localhost:8000 --threshold 75
    devonnbench report benchmark-artifacts/some-run-id.json
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import click

from .runner import run_suite_sync
from .models import BenchmarkRunResult


# ---------------------------------------------------------------------------
# Colour helpers (no external deps)
# ---------------------------------------------------------------------------
RESET  = "\033[0m"
GREEN  = "\033[32m"
RED    = "\033[31m"
YELLOW = "\033[33m"
CYAN   = "\033[36m"
BOLD   = "\033[1m"


def _colour(text: str, code: str) -> str:
    if sys.stdout.isatty():
        return f"{code}{text}{RESET}"
    return text


def _print_summary(result: BenchmarkRunResult) -> None:
    status = _colour("PASS ✓", GREEN) if result.passed else _colour("FAIL ✗", RED)
    click.echo(f"\n{BOLD}DevonnBench — {result.suite_name} v{result.suite_version}{RESET}")
    click.echo(f"Environment : {result.environment}")
    click.echo(f"Base URL    : {result.base_url}")
    click.echo(f"Run ID      : {result.run_id}")
    click.echo(f"Git commit  : {result.git_commit or 'unknown'}")
    click.echo(f"Duration    : {result.duration_seconds:.2f}s")
    click.echo(
        "Cases       : "
        f"total={result.total_cases}  "
        f"executed={result.executed_cases}  "
        f"passed={result.passed_cases}  "
        f"failed={result.failed_cases}  "
        f"skipped={result.skipped_cases}"
    )
    click.echo("")

    # Category table
    click.echo(f"{'Category':<22} {'Weight':>7} {'Raw':>7} {'Weighted':>9} {'Cases':>7}")
    click.echo("-" * 56)
    for cs in result.category_scores:
        if cs.cases_run == 0:
            continue
        row = (
            f"{cs.category.value:<22} "
            f"{cs.weight:>6.0%} "
            f"{cs.raw_score:>7.1f} "
            f"{cs.weighted_score:>9.2f} "
            f"{cs.cases_passed}/{cs.cases_run:>5}"
        )
        colour = GREEN if cs.raw_score >= 80 else (YELLOW if cs.raw_score >= 60 else RED)
        click.echo(_colour(row, colour))

    click.echo("-" * 56)
    score_line = f"{'OVERALL SCORE':<22} {'':>7} {result.overall_score:>7.1f}"
    click.echo(_colour(score_line, GREEN if result.passed else RED))
    click.echo(f"\nResult: {status}  (threshold: {result.threshold})")

    if result.critical_failures:
        click.echo(_colour("\n⚠  CRITICAL SAFETY FAILURES:", RED))
        for cf in result.critical_failures:
            click.echo(_colour(f"   • {cf.value}", RED))

    # Failed cases
    failures = [r for r in result.case_results if not r.skipped and not r.passed]
    if failures:
        click.echo(_colour(f"\nFailed cases ({len(failures)}):", YELLOW))
        for r in failures:
            click.echo(f"  [{r.case_id}] {r.case_name}")
            for ar in r.assertion_results:
                if not ar.passed:
                    click.echo(f"       ↳ {ar.message}")

    skipped = [r for r in result.case_results if r.skipped]
    if skipped:
        click.echo(_colour(f"\nSkipped cases ({len(skipped)}):", YELLOW))
        for r in skipped:
            click.echo(f"  [{r.case_id}] {r.case_name} — {r.skip_reason or 'Case explicitly skipped'}")

    click.echo(f"\nArtifact: {result.artifact_path}")


# ---------------------------------------------------------------------------
# CLI commands
# ---------------------------------------------------------------------------

@click.group()
def cli():
    """DevonnBench — Devonn.AI benchmark harness."""


@cli.command()
@click.argument("suite_path", type=click.Path(exists=True))
@click.option("--base-url", envvar="DEVONN_BASE_URL", required=True, help="Devonn API base URL")
@click.option("--env", "environment", default="unknown", envvar="DEVONN_ENV", help="Deployment environment label")
@click.option("--threshold", default=80.0, type=float, show_default=True, help="Minimum passing score (0-100)")
@click.option("--auth-token", envvar="DEVONN_API_TOKEN", default=None, help="Bearer token for authenticated endpoints")
@click.option("--concurrency", default=5, type=int, show_default=True, help="Max concurrent requests")
@click.option("--output-dir", default="benchmark-artifacts", show_default=True)
@click.option("--devonn-version", envvar="DEVONN_VERSION", default=None)
@click.option("--git-commit", envvar="GITHUB_SHA", default=None)
@click.option("--quiet", is_flag=True, default=False, help="Suppress summary output")
def run(
    suite_path: str,
    base_url: str,
    environment: str,
    threshold: float,
    auth_token: str | None,
    concurrency: int,
    output_dir: str,
    devonn_version: str | None,
    git_commit: str | None,
    quiet: bool,
) -> None:
    """Run a benchmark suite against a Devonn API environment."""
    result = run_suite_sync(
        suite_path,
        base_url=base_url,
        environment=environment,
        threshold=threshold,
        auth_token=auth_token,
        concurrency=concurrency,
        output_dir=output_dir,
        devonn_version=devonn_version,
        git_commit=git_commit,
    )

    if not quiet:
        _print_summary(result)

    # Machine-readable summary for GitHub Actions and shell consumers.
    outputs = {
        "overall_score": str(result.overall_score),
        "passed": str(result.passed).lower(),
        "run_id": result.run_id,
        "critical_failures": ",".join(f.value for f in result.critical_failures),
    }
    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as fh:
            for key, value in outputs.items():
                fh.write(f"{key}={value}\n")
    else:
        click.echo(json.dumps(outputs))

    sys.exit(0 if result.passed else 1)


@cli.command()
@click.argument("artifact_path", type=click.Path(exists=True))
def report(artifact_path: str) -> None:
    """Print a summary from a saved benchmark artifact JSON."""
    with open(artifact_path) as f:
        data = json.load(f)
    result = BenchmarkRunResult(**data)
    _print_summary(result)
    sys.exit(0 if result.passed else 1)


def main():
    cli()


if __name__ == "__main__":
    main()
