# PRIMETIME Intelligence Verification

Release requires all nine intelligence tables to have RLS enabled, restrictive
deny policies for `anon` and `authenticated`, no browser grants, and service-
role access. The `vector` extension must exist before migration.

Cross-workspace inserts and updates must fail for every linked relationship:
membership actors, knowledge sources and versions, chunks, skills, agents,
parent runs, AI actions, retrieval events, and retrieval chunks. A chunk must
also reference a version of its declared source.

No runtime capability is enabled by this schema. Future API work must re-check
workspace authorization on every request, treat retrieved text as data rather
than instructions, preserve resolvable citations, and pass the server-side tool
safety boundary before any action executes.
