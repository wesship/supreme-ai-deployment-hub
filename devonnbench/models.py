"""DevonnBench data models.

The models are intentionally small and dependency-light so the benchmark can run
inside CI, local development, and release gates without pulling in the app stack.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class BenchmarkCategory(str, Enum):
    TASK_SUCCESS = "task_success"
    ORCHESTRATION = "orchestration"
    TOOL_ACCURACY = "tool_accuracy"
    RELIABILITY = "reliability"
    SAFETY = "safety"
    EFFICIENCY = "efficiency"
    AUTHORIZATION = "authorization"
    TENANT_ISOLATION = "tenant_isolation"
    DEPLOYMENT_GATING = "deployment_gating"


class AssertionType(str, Enum):
    STATUS_CODE = "status_code"
    JSON_PATH = "json_path"
    JSON_PATH_EXISTS = "json_path_exists"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    REGEX_CONTAINS = "regex_contains"
    REGEX_NOT_CONTAINS = "regex_not_contains"
    LATENCY_LT = "latency_lt"
    SCHEMA = "schema"
    ACTION_NOT_CALLED = "action_not_called"
    CRITICAL_SAFETY = "critical_safety"


class CriticalFailureReason(str, Enum):
    UNAUTHORIZED_OCC_ACCESS = "unauthorized_occ_access"
    UNAUTHORIZED_ADMIN_ACCESS = "unauthorized_admin_access"
    CROSS_TENANT_DATA = "cross_tenant_data"
    PRODUCTION_DEPLOY_WITHOUT_APPROVAL = "production_deploy_without_approval"
    SECRET_EXFILTRATION = "secret_exfiltration"
    DESTRUCTIVE_WITHOUT_CONFIRMATION = "destructive_without_confirmation"
    FABRICATED_SUCCESS = "fabricated_success"
    PROMPT_INJECTION_BYPASS = "prompt_injection_bypass"
    TOOL_EXECUTION_BYPASS = "tool_execution_bypass"


class Assertion(BaseModel):
    type: AssertionType
    field: Optional[str] = None
    expected: Optional[Any] = None
    threshold_ms: Optional[int] = None
    critical_failure: Optional[CriticalFailureReason] = None
    description: Optional[str] = None


class BenchmarkCase(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    category: BenchmarkCategory
    endpoint: str
    method: str = "GET"
    headers: Dict[str, str] = Field(default_factory=dict)
    body: Optional[Dict[str, Any]] = None
    assertions: List[Assertion] = Field(default_factory=list)
    weight: float = 1.0
    tags: List[str] = Field(default_factory=list)
    skip: bool = False
    skip_reason: Optional[str] = None


class BenchmarkSuite(BaseModel):
    name: str
    version: str
    description: Optional[str] = None
    base_url: str = ""
    required_categories: List[BenchmarkCategory] = Field(default_factory=list)
    cases: List[BenchmarkCase]


class AssertionResult(BaseModel):
    assertion: Assertion
    passed: bool
    actual: Optional[Any] = None
    message: Optional[str] = None


class CaseResult(BaseModel):
    case_id: str
    case_name: str
    category: BenchmarkCategory
    passed: bool
    score: float
    weight: float = 1.0
    skipped: bool = False
    skip_reason: Optional[str] = None
    http_status: Optional[int] = None
    latency_ms: Optional[float] = None
    assertion_results: List[AssertionResult] = Field(default_factory=list)
    critical_failure: Optional[CriticalFailureReason] = None
    estimated_cost_usd: Optional[float] = None
    response_excerpt: Optional[str] = None
    execution_error: Optional[str] = None


class CategoryScore(BaseModel):
    category: BenchmarkCategory
    weight: float
    raw_score: float
    weighted_score: float
    cases_run: int
    cases_passed: int


class BenchmarkRunResult(BaseModel):
    run_id: str
    suite_name: str
    suite_version: str
    devonn_version: Optional[str] = None
    git_commit: Optional[str] = None
    environment: str
    base_url: str
    overall_score: float
    passed: bool
    critical_failures: List[CriticalFailureReason] = Field(default_factory=list)
    coverage_failures: List[str] = Field(default_factory=list)
    category_scores: List[CategoryScore] = Field(default_factory=list)
    case_results: List[CaseResult] = Field(default_factory=list)
    total_cases: int
    executed_cases: int
    passed_cases: int
    failed_cases: int
    skipped_cases: int
    total_latency_ms: float
    estimated_total_cost_usd: float
    threshold: float
    artifact_path: Optional[str] = None
    started_at: str
    finished_at: str
    duration_seconds: float
