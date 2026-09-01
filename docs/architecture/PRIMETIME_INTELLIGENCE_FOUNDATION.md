# PRIMETIME Intelligence Foundation

This gate adds backend-only, workspace-scoped storage for layered memory,
versioned knowledge chunks, retrieval provenance, reusable skill definitions,
durable agent runs, and model usage telemetry.

PRIMETIME remains authoritative for CRM, consent, compliance, suppression, and
regulated state. Generated memory and retrieved content are untrusted inputs;
they cannot grant a tool permission or replace an authoritative record.

Every tenant-owned reference is checked at write time against its declared
workspace, including parent runs, agents, skills, actions, sources, versions,
chunks, retrieval events, and membership actors. Browser roles have a
restrictive deny policy and no table privileges. Only the service role can use
the foundation until a separately reviewed API and authorization gate exists.

The migration also reconciles an existing environment drift: staging already
has the Release 4 knowledge source/version tables, while production does not.
It creates those prerequisites only when absent and applies the same backend-
only posture in both environments.

This gate does not register tools, activate autonomous agents, expose a browser
API, select an embedding provider, or make an automated regulated decision.
