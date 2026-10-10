# Hermes Agent v0.20.6 compatibility matrix

This matrix separates release-gate evidence from integration work. "Verified"
means the repository has an executable check; it does not mean the upstream
runtime is active in production.

| Surface | Status | Evidence / remaining work |
|---|---|---|
| Official source identity | Verified in CI | Trusted repository, tag `v2026.8.27`, peeled commit, and `pyproject.toml` version must agree. |
| Dependency integrity | Verified in CI | Upstream `uv.lock` is required and installed with `uv sync --extra all --locked`. |
| CLI startup | Verified in CI | Installed package version, `hermes --version`, and isolated `hermes config check` run before staging. |
| Atomic release staging | Verified in CI | Immutable commit directory plus atomic `staged` symlink; `current` must remain absent. |
| D3VONN task intake and auth | Existing control plane only | `/api/hermes/tasks` remains protected by D3VONN OCC authentication; no upstream adapter is wired. |
| Durable leases and recovery | Existing control plane only | D3VONN's persistent workers and atomic database leases remain authoritative. Upstream execution compatibility needs adapter tests. |
| Memory / knowledge graph write-back | Pending integration | Define and test an explicit result contract before enabling upstream execution. |
| AI Films workflows | Pending integration | Certify a non-production workflow through the adapter with bounded permissions and artifacts. |
| Observability and cost attribution | Pending integration | Add upstream process health, task correlation, token usage, and failure metrics. |
| VPS resource and security profile | Pending target-host verification | Validate CPU/RAM/disk, service user, egress, secrets, sandboxing, and rollback on the authorized host. |
| Production activation | Not performed | This gate intentionally provides no service restart or `current` promotion. |

The integration remains fail-closed: D3VONN continues using its existing Hermes
control plane until the pending adapter and target-host checks have independent
evidence.
