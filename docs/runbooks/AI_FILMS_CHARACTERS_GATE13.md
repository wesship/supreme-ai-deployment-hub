# AI Films Gate 13 — multiple character identities

This draft PR stacks on Gate 12. It adds a project-scoped character registry and separate `(project_id, character_id, role_id)` draft/release identities. A character has a stable slug and avatar version; its roles may each have a different voice, introduction, approved sources, tools, and independent release version. The SQL transaction verifies that the draft uses that character's immutable avatar version. The signed policy test includes character ID, so another character cannot reuse it. The five existing roles remain allowlisted; mental health support remains closed.

## Staging sequence

1. Apply migrations from Gates 9 and 11, then preview and apply `20260924230000_ai_film_characters.sql`. Inspect grants, composite foreign keys, trigger, and RPC permissions. The legacy project-wide role tables stay intact; existing legacy drafts are not migrated to characters automatically.
2. Configure `AI_FILMS_ROLE_ATTESTATION_SECRET`, enable `AI_FILMS_ROLE_STUDIO_ENABLED` on staging API, and build staging UI with `VITE_AI_FILMS_ROLE_STUDIO_ENABLED=true`.
3. Create two characters with distinct slugs and approved avatar asset version IDs. As editor, save the same Teacher role for both with different voices and sources. Refresh and change the selection repeatedly: revisions and profile data must stay separate. Attempt to save character A's avatar version under B and verify the transaction fails.
4. Policy test character A. Verify the token cannot mark B tested. Use three distinct authorized users to submit, approve, and publish A, then B. Confirm owner-scoped published reads return the correct character ID, profile hash, version and immutable release. Cross-project reads, writes and a locked role must fail.
5. Verify both UI widths and CI on the exact stacked commit. Confirm that archived identities, if set through an administrative process, cannot be written or loaded as active characters. Character creation currently accepts an asset version identifier as a reference; a human must verify ownership, likeness consent, and that the asset really exists. The UI does not render avatars or publish social content.

Character selection loads 50 active identities per page with a stable creation-time and ID order. Search and filtering remain future UI work. Neither flag changes in this PR. Keep gate YELLOW until staging database and browser evidence are captured.

Rollback: disable both feature flags; preserve character records and release history for audit.
