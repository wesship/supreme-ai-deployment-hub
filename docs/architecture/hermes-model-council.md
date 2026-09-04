# Hermes Model Council

## Status

Clean-room architecture proposal for D3VONN.IO. This design is inspired by the general pattern of parallel multi-model inference and competitive evaluation, but does not copy source code, prompts, scoring rules, model lists, or implementation details from third-party AGPL projects.

## Objective

Add a model-level reasoning policy to Hermes that can query multiple providers/models in parallel, evaluate candidate outputs, and return a selected or synthesized result without introducing a second scheduler, queue, persistence engine, or workflow coordinator.

## Placement

```text
User / Agent Goal
        |
        v
Hermes WorkflowExecutionCoordinator
        |
        v
Hermes Parallel Scheduler
        |
        v
Model Council Policy
  |       |       |
  v       v       v
Model A  Model B  Model C ...
   \       |       /
    \      |      /
     v     v     v
Candidate Evaluator
        |
        v
Evidence / KG / RAG verification
        |
        v
Safety + policy gate
        |
        v
Selected / synthesized answer
        |
        v
Hermes checkpoint + event + downstream action
```

The council is a reasoning policy only. Existing Hermes components continue to own task binding, retries, checkpoints, idempotency, cancellation, leases, dispatch, and persistence.

## Modes

### FAST

Use one qualified low-latency model. No council fan-out unless confidence is below threshold.

### SMART

Run a small diverse panel of 2-4 models and select the strongest grounded candidate.

### POWER

Run a larger specialist panel, including reasoning, coding, domain, and multimodal models where appropriate.

### CONSENSUS

Require independent answers, normalize claims, detect agreement/disagreement, and produce a synthesis only after evidence verification.

### REDTEAM

Use one or more critic models to challenge assumptions, identify missing evidence, test edge cases, and surface unsafe or low-confidence actions before execution.

## Core interfaces

```python
class CouncilRequest(BaseModel):
    task_id: str
    execution_id: str
    mode: Literal["fast", "smart", "power", "consensus", "redteam"]
    messages: list[dict]
    context: dict = {}
    required_capabilities: list[str] = []
    max_candidates: int = 4
    timeout_ms: int = 45000
    cost_ceiling_usd: float | None = None


class CandidateResult(BaseModel):
    provider: str
    model: str
    content: str
    latency_ms: int
    estimated_cost_usd: float | None = None
    success: bool
    error: str | None = None
    evidence_refs: list[str] = []
    scores: dict[str, float] = {}


class CouncilDecision(BaseModel):
    selected_model: str | None = None
    selected_content: str
    confidence: float
    candidates: list[CandidateResult]
    disagreements: list[str] = []
    verification: dict = {}
    policy_status: Literal["allow", "review", "block"]
```

## Candidate selection

Selection must not reward verbosity or unsafe non-refusal behavior. Candidate scoring should prioritize:

- factual grounding and citation/evidence support
- task completion and instruction adherence
- consistency with retrieved knowledge and known system state
- calibrated confidence
- safety and policy compliance
- reasoning robustness under critic review
- latency and cost efficiency
- tool/result correctness for executable tasks

Suggested normalized score:

```text
quality =
  0.30 * groundedness
+ 0.20 * task_completion
+ 0.15 * consistency
+ 0.10 * critic_survival
+ 0.10 * tool_correctness
+ 0.05 * confidence_calibration
+ 0.05 * latency_efficiency
+ 0.05 * cost_efficiency
```

Safety is a hard gate, not a positive scoring dimension. A candidate that fails policy validation is ineligible regardless of quality score.

## Parallel execution policy

The Model Council should reuse Hermes concurrency controls instead of creating its own global scheduler.

Within one approved reasoning step:

1. Resolve eligible providers/models from capability registry.
2. Apply provider health, budget, tenant, and policy filters.
3. Launch a bounded number of candidates concurrently.
4. Stream completed candidates into the evaluator.
5. Permit early completion when confidence and evidence thresholds are met.
6. Cancel remaining candidate calls after selection when safe to do so.
7. Persist a compact decision record to the existing Hermes event/checkpoint path.

## Provider registry

Introduce a provider-neutral registry rather than hard-coding models:

```python
ModelDescriptor(
    provider="openai",
    model="...",
    capabilities={"reasoning", "tools", "vision"},
    max_context=..., 
    health="healthy",
    cost_class="standard",
    latency_class="medium",
    enabled=True,
)
```

Providers may include OpenAI, Anthropic, Google, OpenRouter, local/self-hosted models, or future D3VONN model endpoints. Secrets remain server-side.

## Verification chain

For tasks requiring factual accuracy or business execution:

```text
Candidate output
   -> claim extraction
   -> DKOS / RAG / KG lookup
   -> live-source verification where required
   -> contradiction detection
   -> confidence update
   -> policy gate
   -> final decision
```

For code changes:

```text
Candidate patch
   -> static validation
   -> tests
   -> security checks
   -> critic review
   -> merge gate
```

## Knowledge graph integration

The council should emit structured decision metadata suitable for the existing KG/GAP/BRIDGE workflow:

- entities
- claims
- evidence links
- unresolved contradictions
- missing evidence
- confidence
- assumptions
- next-best bridging questions

The knowledge graph layer should run after candidate generation and before irreversible actions whenever the task depends on external facts or persistent organizational state.

## Failure behavior

- One model failure must not fail the council.
- Provider rate limits should reduce fan-out dynamically.
- Budget ceilings must be enforced before dispatch.
- Timeout should return the best verified completed result, not wait indefinitely.
- If all candidates fail verification, return `policy_status="review"` or a typed failure instead of inventing an answer.
- Irreversible or high-impact actions continue to require the existing Hermes approval/HITL gates.

## Observability

Emit structured events for:

- `model_council.started`
- `model_council.candidate_dispatched`
- `model_council.candidate_completed`
- `model_council.candidate_failed`
- `model_council.verification_completed`
- `model_council.decision_selected`
- `model_council.decision_blocked`

Metrics:

- council latency p50/p95
- candidate success rate by provider/model
- selected-model rate
- average candidate count
- early-exit rate
- disagreement rate
- verification failure rate
- cost per council decision
- tool/action correction rate after critic review

## Proposed backend modules

```text
backend/hermes/model_council/
  __init__.py
  schemas.py
  registry.py
  router.py
  executor.py
  evaluator.py
  verifier.py
  policy.py
  telemetry.py
```

## API surface

Internal-first API:

```text
POST /api/hermes/model-council/evaluate
GET  /api/hermes/model-council/models
GET  /api/hermes/model-council/health
```

The workflow coordinator should normally call the service internally rather than exposing it directly to untrusted clients.

## Phase 1 implementation gate

Phase 1 should be intentionally small:

1. Add schemas and provider registry.
2. Support 2-3 server-side providers already configured in D3VONN.
3. Implement `FAST`, `SMART`, and `REDTEAM` only.
4. Limit `SMART` to three candidates.
5. Implement deterministic evaluator with evidence hooks.
6. Add timeout/cancellation and cost ceiling.
7. Emit Hermes events.
8. Add unit tests for partial provider failure, timeout, unsafe candidate rejection, tie handling, and zero-valid-candidate behavior.
9. Keep the feature behind `HERMES_MODEL_COUNCIL_ENABLED=false` until tests and staging validation pass.

## Licensing boundary

Do not copy or adapt third-party AGPL source files, prompt text, model arrays, scoring regexes, comments, or implementation-specific logic into D3VONN.IO. Only the high-level architectural pattern of bounded parallel model querying plus evaluation is being used. All implementation should be independently authored against D3VONN's existing Hermes interfaces.

## Decision

Proceed with a native Hermes Model Council rather than integrating GODMOD3 directly. This preserves D3VONN's existing scheduler, checkpoint, task, event, research, and safety architecture while adding competitive multi-model reasoning as a modular policy layer.
