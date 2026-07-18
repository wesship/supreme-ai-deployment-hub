# PRIMETIME CRM Custom Lists — Technical Debt Register

Related: #403, #404, PR #405

## Temporary and explicitly non-production

| Debt | Status | Reason accepted temporarily | Removal gate |
|---|---|---|---|
| In-memory repository | Open | Enables UI and contract development before Supabase migration | Replace with Supabase repository and RLS integration tests |
| Authenticated actor identity | Resolved | Initial prototype used a hard-coded actor | `useCrmExecutionContext` now derives actor ID from the Supabase session |
| Default workspace context | Open | Workspace membership provider is not yet implemented | Resolve active workspace from authenticated membership and verify authorization |
| Browser prompt/confirm UI | Resolved | Initial interaction scaffold | Replaced with accessible editor and archive dialogs |
| Page-owned mutation state | Resolved | Initial UI prototype | Loading and mutations now flow through `CrmCustomListRepository` and `useCrmCustomLists` |
| Placeholder navigation routes | Open | Only Custom Lists is implemented in Phase 1 | Add route-level unavailable states or real modules |
| Placeholder group/field controls | Open | Table preference model is not yet implemented | Add typed view preferences and persisted user settings |
| Single-page pagination | Open | Seed dataset is small | Add server-side pagination contract before large datasets |

## Architectural controls already applied

- Existing React/Vite application is reused.
- Existing central router and Supabase auth boundary are reused.
- Custom Lists has a typed domain model and repository interface.
- Temporary persistence is isolated behind `CrmCustomListRepository`.
- Page data access and mutations flow through `useCrmCustomLists`.
- Repository instances are isolated per execution context.
- Actor identity is derived from the authenticated Supabase session.
- Workspace ID is routed through one execution-context boundary.
- Workspace and actor metadata are present in the model.
- Archive behavior is represented instead of destructive deletion.
- Loading, empty, and repository-error states are represented.
- Create, edit, archive, search, sorting, and selection have component tests.

## Prohibited shortcuts

- Do not query Supabase directly from table row components.
- Do not duplicate the global router or authentication provider.
- Do not make localStorage the source of truth.
- Do not omit workspace scope from repository methods.
- Do not treat the default workspace environment value as proof of membership.
- Do not merge while accepted temporary persistence or workspace assumptions remain undocumented.
