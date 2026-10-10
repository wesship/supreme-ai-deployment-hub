# Readdy → D3VONN.IO Integration Gate

## Purpose

`wesship/supreme-ai-deployment-hub` remains the canonical D3VONN.IO production repository. Readdy is a design/prototyping source, not a replacement runtime.

This gate exists to prevent a Readdy export from overwriting working D3VONN.IO backend, security, CI, routing, and product surfaces.

## Current repository truth

The repository already contains the core OCC data and runtime surfaces Readdy described, including:

- Supabase-backed OCC tables such as `ai_request_logs`, `tool_call_logs`, `agent_activity_logs`, `error_logs`, `approval_queue`, `user_plans`, and `rag_documents`.
- FastAPI OCC/operator read APIs and logging services.
- OCC frontend data hooks and dashboards.
- The canonical Python/FastAPI backend and deployment/runtime infrastructure.
- Existing D3VONN.IO application areas including Security Ops, Research OS, PRIMETIME, AI Films, Hermes, Voice, THE DOOR, and other production surfaces.

The current verified gaps relative to the Readdy project are:

- Readdy's `marketplace_agents` backend data model is not present on current `main` under that name.
- Readdy's `admin-overview` TypeScript edge function is not present on current `main` under that name.
- Readdy may contain newer frontend implementations for `/admin`, marketplace, and agents that must be reviewed against the existing repo equivalents before import.

## Non-negotiable preservation rules

A Readdy import MUST NOT:

1. Delete, replace, or disable `backend/main.py` or the canonical FastAPI backend.
2. Replace the repository's deployment architecture merely to match Readdy's TypeScript edge-function runtime.
3. Drop existing routes, products, security controls, CI workflows, migrations, or production certifications.
4. Introduce a second conflicting schema for an OCC table that already exists.
5. Commit service-role keys, provider secrets, database credentials, or production tokens into browser code or repository files.
6. bypass RLS, authenticated OCC/admin authorization, approval gates, human-in-the-loop controls, or production feature flags.
7. Make direct production database changes as part of the import. Database changes must be represented by reviewed forward-only migrations and certified in staging first.

## Allowed import scope

Readdy code may be imported when it is additive or is a reviewed replacement of a specific frontend implementation. Preferred scope:

- visual/design improvements;
- `/admin` UI improvements;
- marketplace and agents UI/data adapters;
- additive Supabase migrations for genuinely missing schema;
- additive edge functions when they do not duplicate or weaken canonical FastAPI authority;
- reusable components, assets, and interaction patterns.

## Required reconciliation sequence

1. Export Readdy to a dedicated branch. Never export directly to `main`.
2. Diff the export against current `main`.
3. Classify every changed file as `keep-repo`, `take-readdy`, `manual-merge`, or `reject`.
4. Preserve canonical backend/runtime files first.
5. Reconcile existing OCC tables before adding any schema.
6. Add only missing marketplace/admin data contracts.
7. Run repository lint, typecheck, unit tests, build, CI doctor, workflow audit, security scans, and the required PR gate.
8. Deploy a preview and verify `/`, `/admin`, OCC, marketplace, agents, auth, Security Ops, Research OS, PRIMETIME, AI Films, Hermes, Voice, and THE DOOR remain reachable as applicable.
9. Verify the preview uses the intended Supabase project and does not expose privileged keys.
10. Merge only after the exact PR head is green.

## First merge target

The first Readdy integration PR should be intentionally small:

- import the newer Readdy `/admin` presentation only where it improves the existing admin/OCC experience;
- introduce or map `marketplace_agents` only if the existing marketplace persistence cannot satisfy the same contract;
- port `admin-overview` behavior behind the existing authenticated server boundary, or retain the existing FastAPI admin/OCC endpoint when it already provides equivalent data;
- do not migrate FastAPI to Readdy edge functions.

## Completion criteria

This gate is complete when:

- a Readdy export branch exists;
- the export has been diffed against current `main`;
- no canonical backend/runtime/product surface is removed unintentionally;
- missing Readdy capabilities are mapped to repo-native equivalents or added safely;
- all required GitHub checks pass on the exact integration head;
- preview verification passes before merge.
