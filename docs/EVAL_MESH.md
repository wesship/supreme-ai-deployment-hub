# Devonn.ai Eval Mesh

The Eval Mesh is the dedicated evaluation and scoring layer for Devonn.ai. It turns agent behavior, prompts, tool calls, memory retrieval, and production traces into measurable quality signals before changes reach users.

## Why this exists

LLM and agent systems are probabilistic. A prompt, model, tool, or memory change can improve one workflow while silently breaking another. The Eval Mesh creates a repeatable measurement loop:

```text
Production traces
  -> failure and golden datasets
  -> deterministic scorers
  -> optional LLM-as-judge scorers
  -> experiment comparison
  -> CI/CD regression gate
  -> safer deployment
```

## Placement in the Devonn.ai architecture

```text
Devonn.ai Control Plane
├── Agent Mesh
├── Memory Mesh
├── Tool Mesh
├── Policy Mesh
├── Observability Mesh
└── Eval Mesh
```

The Eval Mesh does not replace tests, Sentry, logs, or policy gates. It adds AI-specific quality measurement for answers, tool usage, memory use, RAG grounding, hallucination risk, and task completion.

## Initial implementation

This first foundation is intentionally lightweight and dependency-free:

- `evals/run_eval.py` — local and CI eval runner
- `evals/datasets/*.jsonl` — golden, failure, and production sample cases
- `evals/scorers/*.py` — deterministic scoring functions
- `evals/schemas/*.json` — trace, case, and score contracts
- `.github/workflows/evals.yml` — PR and manual regression gate

## Core score dimensions

| Score | Purpose |
| --- | --- |
| `task_completion` | Did the agent satisfy the user request? |
| `tool_correctness` | Did the agent use the expected tool/API when required? |
| `memory_recall` | Did the output include required memory/context signals? |
| `rag_grounding` | Did the answer cite or use expected grounding material? |
| `hallucination_risk` | Did the answer avoid unsupported/forbidden claims? |
| `latency` | Did the run stay inside the latency budget? |
| `cost` | Did the run stay inside the token/cost budget? |

## Regression thresholds

The first CI gate uses conservative defaults:

```text
minimum average score: 0.75
minimum case score:    0.50
maximum failures:      0
```

These thresholds should tighten as real production data is collected.

## Production improvement loop

Every meaningful failure should become a new eval case:

```text
User issue or bad trace
  -> sanitize sensitive data
  -> add to failure_cases.jsonl
  -> reproduce with current agent/prompt/model
  -> improve agent behavior
  -> lock improvement with eval gate
```

## Recommended next steps

1. Connect `agent_traces` from production logs into `evals/datasets/production_samples.jsonl`.
2. Add Postgres tables: `eval_runs`, `eval_cases`, `eval_scores`, `agent_traces`, `prompt_versions`, `failure_modes`.
3. Add LLM-as-judge scorers after deterministic scoring is stable.
4. Add an Evaluation Hub page in the admin/Appsmith dashboard.
5. Optionally connect Braintrust, Langfuse, Phoenix, or Weave as external evaluation backends.
