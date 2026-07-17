# PRIMETIME CRM Custom Lists — Technical Debt Register

Related: #403, #404, PR #405

## Temporary and explicitly non-production

| Debt | Reason accepted temporarily | Removal gate |
|---|---|---|
| In-memory repository | Enables UI and contract development before Supabase migration | Replace with Supabase repository and RLS integration tests |
| Development workspace/actor context | Workspace provider is not yet wired into CRM | Resolve from authenticated workspace membership |
| Browser prompt/confirm UI | Fast interaction scaffold | Replace with accessible form and alert dialogs |
| Placeholder navigation routes | Only Custom Lists is implemented in Phase 1 | Add route-level unavailable states or real modules |
| Placeholder group/field controls | Table preference model is not yet implemented | Add typed view preferences and persisted user settings |
| Single-page pagination | Seed dataset is small | Add server-side pagination contract before large datasets |

## Architectural controls already applied

- Existing React/Vite application is reused.
- Existing central router and Supabase auth boundary will be reused.
- Custom Lists now has a typed domain model and repository interface.
- Temporary persistence is isolated behind `CrmCustomListRepository`.
- Workspace and actor metadata are present in the model.
- Archive behavior is represented instead of destructive deletion.

## Prohibited shortcuts

- Do not query Supabase directly from table row components.
- Do not duplicate the global router or authentication provider.
- Do not make localStorage the source of truth.
- Do not omit workspace scope from repository methods.
- Do not merge while browser dialogs, hard-coded tenant identity, and missing tests remain undocumented.
