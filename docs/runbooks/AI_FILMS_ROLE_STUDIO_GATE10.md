# AI Films Role Studio Gate 10 — policy test attestation

This change adds a project-owner-authenticated policy check endpoint behind `AI_FILMS_ROLE_STUDIO_ENABLED`. The server checks a candidate role profile's structure, source ID shape, memory scope, and role-specific tool allowlist, then signs a ten-minute attestation for the exact project, role, revision, and canonical profile hash. No AI generation or avatar render is performed.

The endpoint remains disabled until Gate 9's schema and owner-read path have staging evidence. Set `AI_FILMS_ROLE_ATTESTATION_SECRET` to a separate server-only random value of at least 32 characters in the staging environment; never put it in the frontend or logs. Rotate it to invalidate outstanding attestations.

The authoring workflow must verify the token **inside the same publish transaction** against the persisted draft, including its revision and hash. It must separately verify a distinct authorized reviewer and publisher. The endpoint's input revision is a candidate value, not proof that a draft was saved. A passing policy attestation is not evidence of lip-sync quality, identity consistency, source authorization, or clinical safety.

Local checks: `python3 -m unittest discover -s tests/ai_films -p 'test_role_*.py' -v`.

Gate 10 remains YELLOW until the writer transaction and staging test are complete.
