"""DevonnBench command-line interface."""
from __future__ import annotations

import json
import os
import sys

import click

from .models import BenchmarkRunResult
from .runner import run_suite_sync


def _print_summary(result: BenchmarkRunResult) -> None:
    status = "PASS" if result.passed else "FAIL"
    click.echo(f"\nDevonnBench — {result.suite_name} v{result.suite_version}")
    click.echo(f"Environment : {result.environment}")
    click.echo(f"Base URL    : {result.base_url}")
    click.echo(f"Run ID      : {result.run_id}")
    click.echo(f"Git commit  : {result.git_commit or 'unknown'}")
    click.echo(f"Score       : {result.overall_score:.1f} / threshold {result.threshold}")
    click.echo(f"Result      : {status}")
    click.echo(
        "Cases       : "
        f"total={result.total_cases} executed={result.executed_cases} "
        f"passed={result.passed_cases} failed={result.failed_cases} skipped={result.skipped_cases}"
    )

    if result.critical_failures:
        click.echo("\nCritical failures:")
        for failure in result.critical_failures:
            click.echo(f"  - {failure.value}")

    if result.coverage_failures:
        click.echo("\nCoverage failures:")
        for failure in result.coverage_failures:
            click.echo(f"  - {failure}")

    failures = [case for case in result.case_results if not case.skipped and not case.passed]
    if failures:
        click.echo(f"\nFailed cases ({len(failures)}):")
        for case in failures:
            click.echo(f"  [{case.case_id}] {case.case_name}")
            for assertion in case.assertion_results:
                if not assertion.passed:
                    click.echo(f"    - {assertion.message}")

    click.echo(f"\nArtifact: {result.artifact_path}")


@click.group()
def cli() -> None:
    """DevonnBench release-gate harness."""


@cli.command()
@click.argument("suite_path", type=click.Path(exists=True))
@click.option("--base-url", envvar="DEVONN_BASE_URL", required=True, help="Devonn API base URL")
@click.option("--env", "environment", default="unknown", envvar="DEVONN_ENV")
@click.option("--threshold", default=80.0, type=float, show_default=True)
@click.option("--auth-token", envvar="DEVONN_API_TOKEN", default=None)
@click.option("--concurrency", default=5, type=int, show_default=True)
@click.option("--output-dir", default="benchmark-artifacts", show_default=True)
@click.option("--d3vonn-version", envvar="DEVONN_VERSION", default=None)
@click.option("--git-commit", envvar="GITHUB_SHA", default=None)
@click.option("--quiet", is_flag=True, default=False)
def run(
    suite_path: str,
    base_url: str,
    environment: str,
    threshold: float,
    auth_token: str | None,
    concurrency: int,
    output_dir: str,
    d3vonn_version: str | None,
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
        d3vonn_version=d3vonn_version,
        git_commit=git_commit,
    )

    if not quiet:
        _print_summary(result)

    outputs = {
        "overall_score": str(result.overall_score),
        "passed": str(result.passed).lower(),
        "run_id": result.run_id,
        "critical_failures": ",".join(failure.value for failure in result.critical_failures),
        "coverage_failures": ",".join(result.coverage_failures),
    }
    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as handle:
            for key, value in outputs.items():
                handle.write(f"{key}={value}\n")
    else:
        click.echo(json.dumps(outputs))

    sys.exit(0 if result.passed else 1)


@cli.command()
@click.argument("artifact_path", type=click.Path(exists=True))
def report(artifact_path: str) -> None:
    """Print a summary from a saved artifact."""
    with open(artifact_path, encoding="utf-8") as handle:
        result = BenchmarkRunResult(**json.load(handle))
    _print_summary(result)
    sys.exit(0 if result.passed else 1)


if __name__ == "__main__":
    cli()
