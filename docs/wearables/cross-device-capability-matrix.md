# D3VONN cross-device capability matrix

Statuses describe the repository's current truth boundary, not a hardware vendor's maximum capability.

| Capability | Public display preview | Apple Vision Pro path | D3VONN web | Server/agent |
|---|---|---|---|---|
| Glanceable interface | Preview live | Planned | Live where routed | Not applicable |
| AI assistant | UI preview only | Planned | Available through governed surfaces | Governed runtime |
| Notifications | UI preview only | Planned | Governed surface-dependent | Governed runtime |
| PRIMETIME control | UI preview only | Planned | Authenticated surfaces | Approval-controlled |
| HNF Radio | UI preview only | Planned | Surface-dependent | Service-dependent |
| Camera/vision events | No capture | Entitlement-dependent | Browser-dependent | Canonical contract defined |
| Spatial/3D UI | No | Planned | Browser/platform-dependent | Not applicable |
| Offline local AI | No | Not certified | Limited | Worker-dependent |

## Principle

Clients consume authenticated D3VONN capability APIs only after their adapter and session are certified. Device-specific features remain behind adapters; no client UI is an authorization source.
