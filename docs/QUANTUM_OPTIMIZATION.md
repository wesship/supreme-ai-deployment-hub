# D3VONN Quantum Optimization

## Status

Wave 1 establishes a provider-neutral optimization service with a deterministic
local baseline and simulator-shaped adapter. It is intentionally **not** a claim
of physical quantum execution or quantum advantage.

## Architecture

```text
Agent Mesh
    |
    v
Governance / budget gate
    |
    v
QuantumOptimizationService
    |
    +--> Classical baseline
    |
    +--> Provider adapter
           +--> Local simulator (default)
           +--> IBM Quantum (future adapter)
           +--> AWS Braket (future adapter)
    |
    v
Benchmark + experiment record
```

## Production policy

1. Always calculate a classical baseline.
2. Never claim quantum advantage unless the measured objective exceeds the
   configured baseline threshold.
3. Enforce an execution budget before provider invocation.
4. Keep provider credentials and SDKs outside the core optimization package.
5. Record experiment identity, backend, cost, objective, and execution metadata.
6. Physical QPU execution must be disabled until provider credentials, pricing,
   data handling, and governance policy are explicitly approved.

## First production workload

Campaign/resource allocation is the preferred first workload because it can be
expressed as a constrained binary optimization problem and benchmarked against
classical methods. Suitable objectives include expected revenue, CAC reduction,
capacity utilization, and budget allocation.

## Next wave

- Add IBM Quantum and AWS Braket adapters behind the provider protocol.
- Add persistent experiment records and Prometheus metrics.
- Add an API endpoint under the existing Agent Mesh governance layer.
- Add adaptive shot allocation and provider cost estimation.
- Add a Quantum Advantage dashboard showing classical-vs-quantum quality,
  latency, and cost.
