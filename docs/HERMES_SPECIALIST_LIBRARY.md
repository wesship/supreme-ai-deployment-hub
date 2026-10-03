# Hermes specialist library: first import gate

Three upstream agent profiles are vendored from `wshobson/agents` at revision
`156b7a5e7a8b93642628a339ee4039c925b34c7f`, with their original MIT license:

| Hermes skill ID | Specialist | Allowed agents |
| --- | --- | --- |
| wshobson-fastapi | FastAPI engineering | Hermes, TARS |
| wshobson-security | Backend security review | Hermes, GUARDIAN |
| wshobson-testing | Test design and review | Hermes, TARS |

These upstream **agent instruction profiles** are exposed as supplemental skill
knowledge. They are not independent workers and do not install the upstream
plugins, commands, hooks, memory systems, or model assignments.

## Current behavior

The existing skill registry contains the three profiles with `enabled=false`.
The operator-authenticated `GET /api/hermes/tasks/specialists` endpoint lists
their provenance and pilot status. The default enabled skills and canonical
agent hierarchy remain intact.

`resolve_specialist` authorizes against trusted server registries, verifies the
vendored bytes against the pinned SHA-256, and strips source YAML frontmatter.
The returned content has supplemental authority and carries source provenance.
Disabled profiles, insufficient permissions, incompatible/disabled agents,
unknown profiles, modified bytes, and escaped local paths are rejected.

Hermes retains routing, model selection, tool access, budget enforcement,
approvals, task persistence, and release authority. No download or install is
performed at runtime. Imported prose is knowledge, never authorization.

## Bounded pilot and promotion

1. Select one staging FastAPI change, such as reviewing public dashboard error
   handling. Use a fixed repository revision and acceptance criteria.
2. Compare the existing workflow with a server-created isolated pilot registry
   that explicitly enables only these profiles. Never accept registries or agent
   permissions from request data.
3. Resolve the appropriate profile, persist its provenance on the Hermes task,
   and attach its content beneath canonical system/policy instructions in the
   coding worker. The production dispatcher is not yet connected to this loader.
4. Record task/run IDs, actual model and token cost, duration, tests, security
   findings, reviewer outcome, and upstream revision for both runs.
5. Promote only after the pilot improves or maintains correctness and passes
   existing policy and budget controls. Production default remains disabled
   until execution wiring, provenance persistence, and evaluation are complete.

Unit checks verify import integrity and authorization. They do not establish
model quality, live execution compatibility, or production readiness. No live
model pilot or production deployment is included in this import gate.

Rollback: remove the three registrations and the optional catalog endpoint;
no schema migration, credential change, or worker replacement is required.
