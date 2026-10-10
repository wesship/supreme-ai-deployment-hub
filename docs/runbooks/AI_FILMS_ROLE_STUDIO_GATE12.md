# AI Films Role Studio Gate 12 — connected workspace

This draft PR stacks on Gate 11. It adds Role Studio to the existing AI Film Studio page when `VITE_AI_FILMS_ROLE_STUDIO_ENABLED=true` is set at build time. The backend still requires `AI_FILMS_ROLE_STUDIO_ENABLED=true` at runtime and the Gate 9 and 11 migrations. Neither flag is enabled in this PR.

The workspace loads an authenticated project draft, edits five approved role types, requests a server policy check, and sends revision-bound review and release actions. The server checks project membership on draft reads. Policy checks now permit active editors as well as the project owner; published profile reads remain owner scoped. The `mental_health` role remains unavailable.

## Staging acceptance

1. Merge the stacked PRs in order, preview and apply the role migrations, configure the attestation secret, then enable the backend flag only in staging. Build a staging client with the frontend flag enabled. Confirm the normal page has no Role Studio without the client flag.
2. Sign in and connect the AI Film project. As an owner or active editor, create a Teacher draft with a valid approved source ID. Save, reload, edit, discard, save again, and confirm revision and profile persist. Test multiple source IDs and stale revision conflicts.
3. Run the policy test as an active editor, request review, approve as a different authorized reviewer, and publish as a third authorized publisher. Confirm the released version in the owner-scoped read API. Confirm UI errors accurately reflect server denials for wrong roles, stale revisions, expired attestations, or trying to review or publish one's own work.
4. Exercise Radio DJ with its mandatory cleared catalog, then verify cross-role tool injection and `mental_health` requests fail at the API. Review source rights, voice and likeness consent, avatar output, and any regulated content with humans before using any release in content production.
5. Check CI on the exact commit and perform a staging browser pass at desktop and mobile widths. This PR provides neither media rendering nor social posting.

Rollback: disable the frontend flag in the next client build and unset the backend flag. Preserve drafts and release records for audit. Gate stays YELLOW until staging and CI evidence exist.
