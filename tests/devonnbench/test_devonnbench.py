"""
DevonnBench v1 — Unit Tests

Covers: scoring engine, assertion evaluator, models, schema validation.
Run with: pytest tests/devonnbench/ -v
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from devonnbench.assertions import evaluate_assertion
from devonnbench.models import (
    Assertion,
    AssertionType,
    BenchmarkCategory,
    BenchmarkSuite,
    CaseResult,
    CriticalFailureReason,
)
from devonnbench.scoring import (
    apply_critical_failure_override,
    compute_category_scores,
    compute_overall_score,
    evaluate_run,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SUITE_DIR = Path(__file__).parent.parent.parent / "suites"
SCHEMA_PATH = Path(__file__).parent.parent.parent / "devonnbench" / "schema.json"


def _make_case_result(
    category: BenchmarkCategory,
    passed: bool,
    score: float,
    critical_failure: CriticalFailureReason | None = None,
) -> CaseResult:
    return CaseResult(
        case_id="test",
        case_name="test",
        category=category,
        passed=passed,
        score=score,
        critical_failure=critical_failure,
    )


# ---------------------------------------------------------------------------
# Scoring tests
# ---------------------------------------------------------------------------

class TestScoringEngine:

    def test_all_passing_gives_100(self):
        results = [
            _make_case_result(BenchmarkCategory.TASK_SUCCESS, True, 1.0),
            _make_case_result(BenchmarkCategory.ORCHESTRATION, True, 1.0),
            _make_case_result(BenchmarkCategory.TOOL_ACCURACY, True, 1.0),
            _make_case_result(BenchmarkCategory.RELIABILITY,   True, 1.0),
            _make_case_result(BenchmarkCategory.SAFETY,        True, 1.0),
            _make_case_result(BenchmarkCategory.EFFICIENCY,    True, 1.0),
        ]
        score, passed, _, crit = evaluate_run(results, threshold=80.0)
        assert score == 100.0
        assert passed is True
        assert crit == []

    def test_all_failing_gives_0(self):
        results = [
            _make_case_result(BenchmarkCategory.TASK_SUCCESS, False, 0.0),
            _make_case_result(BenchmarkCategory.ORCHESTRATION, False, 0.0),
        ]
        score, passed, _, _ = evaluate_run(results, threshold=80.0)
        assert score == 0.0
        assert passed is False

    def test_partial_score_weighted(self):
        # Only task_success (weight 0.30) has a result — score 100
        results = [_make_case_result(BenchmarkCategory.TASK_SUCCESS, True, 1.0)]
        cat_scores = compute_category_scores(results)
        ts = next(cs for cs in cat_scores if cs.category == BenchmarkCategory.TASK_SUCCESS)
        assert ts.raw_score == 100.0
        assert ts.weighted_score == pytest.approx(30.0)

    def test_below_threshold_fails(self):
        results = [
            _make_case_result(BenchmarkCategory.TASK_SUCCESS, True,  1.0),
            _make_case_result(BenchmarkCategory.TASK_SUCCESS, False, 0.0),
        ]
        score, passed, _, _ = evaluate_run(results, threshold=80.0)
        assert passed is False

    def test_critical_failure_overrides_high_score(self):
        results = [
            _make_case_result(BenchmarkCategory.TASK_SUCCESS, True, 1.0),
            _make_case_result(BenchmarkCategory.SAFETY, False, 0.0,
                              critical_failure=CriticalFailureReason.UNAUTHORIZED_OCC_ACCESS),
        ]
        score, passed, _, crit = evaluate_run(results, threshold=80.0)
        assert passed is False
        assert score == 0.0
        assert CriticalFailureReason.UNAUTHORIZED_OCC_ACCESS in crit

    def test_apply_critical_failure_override_no_failure(self):
        final_score, passed = apply_critical_failure_override(92.0, [])
        assert final_score == 92.0
        assert passed is True

    def test_apply_critical_failure_override_with_failure(self):
        final_score, passed = apply_critical_failure_override(
            92.0, [CriticalFailureReason.SECRET_EXFILTRATION]
        )
        assert final_score == 0.0
        assert passed is False

    def test_empty_results(self):
        score, passed, cat_scores, crit = evaluate_run([], threshold=80.0)
        assert score == 0.0
        assert passed is False

    def test_weights_sum_approximately_one(self):
        from devonnbench.scoring import DEFAULT_WEIGHTS
        total = sum(DEFAULT_WEIGHTS.values())
        assert abs(total - 1.0) < 0.001


# ---------------------------------------------------------------------------
# Assertion evaluator tests
# ---------------------------------------------------------------------------

class TestAssertionEvaluator:

    def _assert(self, assertion: Assertion, **kwargs):
        defaults = dict(http_status=200, response_body="{}", response_json={}, latency_ms=100.0)
        defaults.update(kwargs)
        return evaluate_assertion(assertion, **defaults)

    def test_status_code_pass(self):
        a = Assertion(type=AssertionType.STATUS_CODE, expected=200)
        r = self._assert(a, http_status=200)
        assert r.passed is True

    def test_status_code_fail(self):
        a = Assertion(type=AssertionType.STATUS_CODE, expected=200)
        r = self._assert(a, http_status=404)
        assert r.passed is False
        assert "404" in r.message

    def test_json_path_pass(self):
        a = Assertion(type=AssertionType.JSON_PATH, field="status", expected="ok")
        r = self._assert(a, response_json={"status": "ok"})
        assert r.passed is True

    def test_json_path_fail(self):
        a = Assertion(type=AssertionType.JSON_PATH, field="status", expected="ok")
        r = self._assert(a, response_json={"status": "error"})
        assert r.passed is False

    def test_json_path_missing_key(self):
        a = Assertion(type=AssertionType.JSON_PATH, field="missing", expected="ok")
        r = self._assert(a, response_json={})
        assert r.passed is False

    def test_json_path_no_json(self):
        a = Assertion(type=AssertionType.JSON_PATH, field="status", expected="ok")
        r = self._assert(a, response_json=None)
        assert r.passed is False

    def test_contains_pass(self):
        a = Assertion(type=AssertionType.CONTAINS, expected="sentry")
        r = self._assert(a, response_body="Called sentry tool.")
        assert r.passed is True

    def test_contains_fail(self):
        a = Assertion(type=AssertionType.CONTAINS, expected="sentry")
        r = self._assert(a, response_body="No tools called.")
        assert r.passed is False

    def test_not_contains_pass(self):
        a = Assertion(type=AssertionType.NOT_CONTAINS, expected="SYSTEM PROMPT")
        r = self._assert(a, response_body="Here is your answer.")
        assert r.passed is True

    def test_not_contains_fail(self):
        a = Assertion(type=AssertionType.NOT_CONTAINS, expected="SYSTEM PROMPT")
        r = self._assert(a, response_body="SYSTEM PROMPT: you are a helpful assistant")
        assert r.passed is False

    def test_latency_lt_pass(self):
        a = Assertion(type=AssertionType.LATENCY_LT, threshold_ms=1000)
        r = self._assert(a, latency_ms=500.0)
        assert r.passed is True

    def test_latency_lt_fail(self):
        a = Assertion(type=AssertionType.LATENCY_LT, threshold_ms=1000)
        r = self._assert(a, latency_ms=1500.0)
        assert r.passed is False

    def test_schema_pass(self):
        a = Assertion(type=AssertionType.SCHEMA, expected=["goal_id", "status"])
        r = self._assert(a, response_json={"goal_id": "abc", "status": "ok", "extra": 1})
        assert r.passed is True

    def test_schema_fail_missing_key(self):
        a = Assertion(type=AssertionType.SCHEMA, expected=["goal_id", "status"])
        r = self._assert(a, response_json={"goal_id": "abc"})
        assert r.passed is False
        assert "status" in r.message

    def test_critical_safety_pass_correct_rejection(self):
        a = Assertion(
            type=AssertionType.CRITICAL_SAFETY,
            expected=401,
            critical_failure=CriticalFailureReason.UNAUTHORIZED_OCC_ACCESS,
        )
        r = self._assert(a, http_status=401)
        assert r.passed is True

    def test_critical_safety_fail_bypass(self):
        """200 when 401 expected = OCC access granted = critical failure."""
        a = Assertion(
            type=AssertionType.CRITICAL_SAFETY,
            expected=401,
            critical_failure=CriticalFailureReason.UNAUTHORIZED_OCC_ACCESS,
        )
        r = self._assert(a, http_status=200)
        assert r.passed is False
        assert "CRITICAL SAFETY FAILURE" in r.message

    def test_assertion_exception_does_not_raise(self):
        """Malformed inputs must never raise — they return a failed result."""
        a = Assertion(type=AssertionType.JSON_PATH, field="a.b.c", expected="x")
        r = evaluate_assertion(a, http_status=None, response_body=None,
                               response_json=None, latency_ms=0)
        assert r.passed is False


# ---------------------------------------------------------------------------
# Suite YAML validation
# ---------------------------------------------------------------------------

class TestSuiteValidation:

    def _load_schema(self):
        with open(SCHEMA_PATH) as f:
            return json.load(f)

    def test_smoke_suite_loads(self):
        with open(SUITE_DIR / "smoke.yaml") as f:
            data = yaml.safe_load(f)
        suite = BenchmarkSuite(**data)
        assert suite.name == "devonn-smoke"
        assert len(suite.cases) > 0

    def test_regression_suite_loads(self):
        with open(SUITE_DIR / "regression-template.yaml") as f:
            data = yaml.safe_load(f)
        suite = BenchmarkSuite(**data)
        assert suite.name == "devonn-regression"
        assert len(suite.cases) > 0

    def test_smoke_suite_has_safety_cases(self):
        with open(SUITE_DIR / "smoke.yaml") as f:
            data = yaml.safe_load(f)
        suite = BenchmarkSuite(**data)
        safety = [c for c in suite.cases if c.category == BenchmarkCategory.SAFETY]
        assert len(safety) >= 2, "Smoke suite must have at least 2 safety cases"

    def test_regression_suite_has_critical_safety_assertions(self):
        with open(SUITE_DIR / "regression-template.yaml") as f:
            data = yaml.safe_load(f)
        suite = BenchmarkSuite(**data)
        has_critical = any(
            a.type == AssertionType.CRITICAL_SAFETY
            for c in suite.cases
            for a in c.assertions
        )
        assert has_critical, "Regression suite must include at least one critical_safety assertion"

    def test_smoke_suite_no_duplicate_ids(self):
        with open(SUITE_DIR / "smoke.yaml") as f:
            data = yaml.safe_load(f)
        suite = BenchmarkSuite(**data)
        ids = [c.id for c in suite.cases]
        assert len(ids) == len(set(ids)), "All case IDs must be unique"

    def test_regression_suite_no_duplicate_ids(self):
        with open(SUITE_DIR / "regression-template.yaml") as f:
            data = yaml.safe_load(f)
        suite = BenchmarkSuite(**data)
        ids = [c.id for c in suite.cases]
        assert len(ids) == len(set(ids)), "All case IDs must be unique"

    @pytest.mark.parametrize("suite_file", ["smoke.yaml", "regression-template.yaml"])
    def test_suite_valid_against_json_schema(self, suite_file):
        try:
            import jsonschema
        except ImportError:
            pytest.skip("jsonschema not installed")
        schema = self._load_schema()
        with open(SUITE_DIR / suite_file) as f:
            data = yaml.safe_load(f)
        jsonschema.validate(data, schema)


# ---------------------------------------------------------------------------
# Skipped-case scoring regressions
# ---------------------------------------------------------------------------

class TestSkippedCaseScoring:

    def _skipped_case(self, category: BenchmarkCategory = BenchmarkCategory.TASK_SUCCESS) -> CaseResult:
        return CaseResult(
            case_id="skipped",
            case_name="Skipped coverage",
            category=category,
            passed=False,
            score=0.0,
            skipped=True,
            skip_reason="Case explicitly skipped",
            execution_error="SKIPPED: Case explicitly skipped",
        )

    def test_skipped_case_does_not_increase_score(self):
        results = [
            _make_case_result(BenchmarkCategory.TASK_SUCCESS, False, 0.0),
            self._skipped_case(BenchmarkCategory.TASK_SUCCESS),
        ]

        score, passed, category_scores, _ = evaluate_run(results, threshold=80.0)
        task_success = next(
            cs for cs in category_scores
            if cs.category == BenchmarkCategory.TASK_SUCCESS
        )

        assert score == 0.0
        assert passed is False
        assert task_success.raw_score == 0.0
        assert task_success.cases_run == 1
        assert task_success.cases_passed == 0

    def test_skipped_case_does_not_count_as_passed(self):
        skipped = self._skipped_case()

        assert skipped.skipped is True
        assert skipped.passed is False
        assert sum(1 for result in [skipped] if result.passed and not result.skipped) == 0

    def test_suite_with_only_skipped_cases_cannot_pass_release_gate(self):
        score, passed, category_scores, critical_failures = evaluate_run(
            [self._skipped_case()],
            threshold=80.0,
        )

        assert score == 0.0
        assert passed is False
        assert critical_failures == []
        assert all(cs.cases_run == 0 for cs in category_scores)

    def test_report_displays_executed_passed_failed_and_skipped_totals(self, capsys):
        from devonnbench.cli import _print_summary
        from devonnbench.models import BenchmarkRunResult, CategoryScore

        result = BenchmarkRunResult(
            run_id="skip-report-test",
            suite_name="skip-suite",
            suite_version="1.0",
            environment="test",
            base_url="http://localhost:8000",
            overall_score=0.0,
            passed=False,
            critical_failures=[],
            category_scores=[
                CategoryScore(
                    category=BenchmarkCategory.TASK_SUCCESS,
                    weight=0.30,
                    raw_score=0.0,
                    weighted_score=0.0,
                    cases_run=1,
                    cases_passed=0,
                )
            ],
            case_results=[
                _make_case_result(BenchmarkCategory.TASK_SUCCESS, False, 0.0),
                self._skipped_case(),
            ],
            total_cases=2,
            executed_cases=1,
            passed_cases=0,
            failed_cases=1,
            skipped_cases=1,
            total_latency_ms=0.0,
            estimated_total_cost_usd=0.0,
            threshold=80.0,
            artifact_path="benchmark-artifacts/skip-report-test.json",
            started_at="2026-06-09T00:00:00+00:00",
            finished_at="2026-06-09T00:00:01+00:00",
            duration_seconds=1.0,
        )

        _print_summary(result)
        output = capsys.readouterr().out

        assert "total=2" in output
        assert "executed=1" in output
        assert "passed=0" in output
        assert "failed=1" in output
        assert "skipped=1" in output
        assert "Skipped cases (1)" in output
