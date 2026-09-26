# AI Films Gate 15 — approved character source snapshots

This draft stacks on Gate 14. It adds project-scoped source snapshots for teacher, instructor, radio DJ, host and support roles. A project editor submits text and a different owner or designated reviewer approves it. The content, title, rights basis and hash cannot change after submission. The owner can revoke an approved source, which immediately makes releases referencing it unavailable for source search.

The published role profile's `sources` entries must be canonical source UUIDs to use search. Legacy free-form source identifiers can still exist in old role releases but cannot be treated as grounded. A new role revision, independent approval and release are needed to point to approved snapshot IDs. The search endpoint requires the latest active character release and a complete approved set, verifies every content hash, and returns original excerpts with source IDs and hashes. It does not generate or publish an answer.

## Staging acceptance

1. Apply the ordered Gate 9, 11, 13, then 15 migrations in an isolated staging database. Keep `AI_FILMS_ROLE_STUDIO_ENABLED` and `AI_FILMS_CHARACTER_SOURCES_ENABLED` off in production. Enable them only in staging.
2. As a project editor, submit a small owned/licensed source at `POST /api/ai-films/projects/{project_id}/sources` with `title`, `content` and `rights_basis`. Confirm list pagination omits the content, while an authorized reviewer can read the exact text at `GET /api/ai-films/projects/{project_id}/sources/{source_id}`.
3. Confirm the submitter cannot approve their own source. As a distinct project owner or reviewer, approve it at `POST /api/ai-films/projects/{project_id}/sources/{source_id}/approve`. Confirm anonymous and unrelated users cannot list, read, submit or approve.
4. Put the approved source UUID in a character role draft, complete role policy testing and independent review, and publish a new release. As project owner, send `{"question":"..."}` to `POST /api/ai-films/projects/{project_id}/characters/{character_id}/roles/{role_id}/source-search`. Check the release hash, source hash, original excerpt and `answer_generated: false`. Check that a question without a substantive match returns no excerpts.
5. Revoke the source as owner using `POST /api/ai-films/projects/{project_id}/sources/{source_id}/revoke` and confirm search fails closed. Repeat with a missing source, cross-project source ID, edited content/hash, duplicate ID, and a legacy free-form source ID. Confirm the Gate 14 voice preview still cannot call a source tool or a Hermes action.
6. Review the exact commit's CI and run database security/performance advisors after migration. Validate SQL triggers and RPC transitions on staging before any production migration.

Rollback: turn off `AI_FILMS_CHARACTER_SOURCES_ENABLED`. Approved source data remains for review, and the voice preview remains isolated. Gate stays YELLOW until staging proves tenant isolation, independent approval, revocation and original excerpts. This gate is not a therapist, licensed advisor, autonomous DJ, or public teaching launch.
