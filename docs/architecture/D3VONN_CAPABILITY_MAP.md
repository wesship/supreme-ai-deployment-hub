# D3VONN Capability Map

| Capability | Existing system | Integration direction |
|---|---|---|
| Public website | `wesship/devonnai` | Keep separate |
| Authenticated platform | Supreme AI Deployment Hub | Extend in place |
| Operator Command Center | Existing `/admin` | Reuse |
| Worker persistence | Hermes worker registry track | Reuse |
| Genesis workflows | Existing Genesis track | Reconcile before merge |
| PRIMETIME CRM | Existing governed `primetime_*` track | Reuse |
| Shared event contracts | `src/platform/d3vonn/contracts.ts` | Added |
| Typed event SDK | `src/platform/d3vonn/sdk.ts` | Added |
| Configuration boundary | `src/platform/d3vonn/config.ts` | Added |
| Database migrations | Existing governed process | No changes |
| Marketplace manifests | Shared contract only | Implement after governance review |
| Knowledge graph/digital twins | Existing/future domain modules | Add only where not duplicated |

## Architecture rule

New D3VONN capabilities should first look for an existing governed implementation in Hermes, Genesis, PRIMETIME, OCC, the Supabase layer, or the deployment platform. Add a new subsystem only when no compatible canonical implementation exists.
