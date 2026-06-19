# DevonnBench Scorecard

> **Instructions**: Fill this out after each formal benchmark run.
> Copy the run artifact JSON values into the table below.

---

## Run Metadata

| Field              | Value |
|--------------------|-------|
| Run ID             | `{run_id}` |
| Suite              | `{suite_name}` v`{suite_version}` |
| Devonn Version     | `{devonn_version}` |
| Git Commit         | `{git_commit}` |
| Environment        | `{environment}` |
| Date               | `{started_at}` |
| Duration           | `{duration_seconds}s` |
| Model Config       | _(fill in: model name, temperature, max_tokens)_ |
| Trials             | _(fill in: number of independent runs averaged)_ |

---

## Overall Result

| Score | Threshold | Passed | Critical Failures |
|-------|-----------|--------|-------------------|
| **{overall_score}** | {threshold} | **{passed}** | {critical_failures_count} |

---

## Category Breakdown

| Category           | Weight | Raw Score | Weighted | Cases Passed |
|--------------------|--------|-----------|----------|--------------|
| Task Success       | 30%    |           |          |              |
| Orchestration      | 20%    |           |          |              |
| Tool Accuracy      | 15%    |           |          |              |
| Reliability        | 15%    |           |          |              |
| Safety & Governance| 10%    |           |          |              |
| Efficiency & Cost  | 10%    |           |          |              |
| **TOTAL**          |        |           | **{overall_score}** | {passed_cases}/{total_cases} |

---

## Critical Safety Status

- [ ] No critical safety failures recorded
- [ ] Critical failures present (**BLOCKS RELEASE**):

| Failure Type | Case ID | Notes |
|--------------|---------|-------|
|              |         |       |

---

## Failed Cases

| Case ID | Case Name | Category | Score | Failure Reason |
|---------|-----------|----------|-------|----------------|
|         |           |          |       |                |

---

## Cost & Latency

| Metric                     | Value |
|----------------------------|-------|
| Total Latency (ms)         | {total_latency_ms} |
| Estimated Total Cost (USD) | ${estimated_total_cost_usd} |
| Est. Cost per Workflow     | _(calculate: cost / passed workflows)_ |
| p50 Latency                | _(from load test if available)_ |
| p95 Latency                | _(from load test if available)_ |

---

## Known Limitations

- _List any known gaps in coverage, skipped cases, or environmental caveats_
- _Specify if grading was deterministic (status codes, schema) vs model-based_

---

## Public Benchmark Statement (after ≥10 verified runs)

> Devonn.AI completed **__%** of verified workflows, selected the correct tool in
> **__%** of cases, recovered from **__%** of simulated transient failures,
> produced **zero** critical authorization bypasses, and averaged
> **$0.00** per successful workflow.
>
> *Benchmark: DevonnBench v{suite_version} | Devonn commit: {git_commit} |
> Model: _____ | Environment: {environment} | Trials: __ | Date: {started_at} |
> Grading: deterministic (status codes + schema) except where noted.*

---

## Comparison to Previous Run

| Metric          | Previous | Current | Delta |
|-----------------|----------|---------|-------|
| Overall Score   |          |         |       |
| Task Success    |          |         |       |
| Orchestration   |          |         |       |
| Tool Accuracy   |          |         |       |
| Reliability     |          |         |       |
| Safety          |          |         |       |
| Efficiency      |          |         |       |
| Est. Cost/Run   |          |         |       |

> ⚠️ A category regression >5 points blocks staging promotion.
> A critical failure blocks RC promotion regardless of score.
