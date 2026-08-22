# DKOS Universal Acquisition — Phase 2

## Purpose

Phase 2 connects authorized acquisition sources to the existing DKOS security boundary without granting crawlers or AI agents unrestricted network or account access.

## Source strategy

- Google Drive, Docs, and Sheets: official Google APIs.
- GitHub: official GitHub API for authorized repository/account data.
- Local Downloads/Documents: controlled filesystem ingestion.
- Permitted public web sources: Crawlee.
- JavaScript-heavy permitted web sources: Crawlee + Playwright when required.

Crawlee remains an acquisition component. DKOS remains the trust, processing, provenance, classification, and agent-access plane.

## Safety pipeline

```text
source authorization
  -> discovery/inventory
  -> acquisition policy
  -> isolated staging
  -> SHA-256 + metadata
  -> file/type validation
  -> malware/content/secret scan
  -> quarantine or approved
  -> classification
  -> DKOS processing
  -> artifact/index creation
  -> agent access policy
```

## Required invariants

1. Acquisition jobs have a unique run ID and source/account identity.
2. Credentials are server-side only and never become crawler output.
3. Acquired content starts as `untrusted`.
4. Original bytes are preserved in isolated staging before transformations.
5. Every object receives a content hash before deduplication.
6. Parser and scanner failures fail closed into quarantine.
7. Restricted material cannot reach an agent without the existing human approval control.
8. Web acquisition is allowlisted and HTTPS-only by default.
9. Official account APIs are preferred over UI scraping.
10. No connector may bypass DKOS policy by writing directly to an AI/vector index.
11. Jobs must support cancellation before production scheduling is enabled.
12. Every downstream artifact retains provenance back to the acquisition run and source object.

## Discovery-first model

Large accounts should not immediately download everything. The first operation inventories metadata and estimates volume. The user can then select all, a folder, a file class, a date range, or a bounded subset.

Example states:

`DISCOVERED -> SELECTED -> QUEUED -> ACQUIRED -> SCANNING -> QUARANTINED|APPROVED -> PROCESSED -> INDEXED`

## Incremental sync

Use stable remote identifiers plus modified/version metadata and content hashes. Re-acquisition should be skipped when the source version and content hash are unchanged. Deletions or permission loss must be recorded as state changes rather than silently removing provenance.

For Google Drive, use the Drive API's file listing for inventory and its changes mechanism for subsequent synchronization. Do not scrape Drive's web UI.

## Quarantine

Quarantine is mandatory for:

- malware or scanner detections;
- malformed or contradictory file types;
- archive expansion beyond configured limits;
- secret/credential detections requiring review;
- parser crashes or timeouts;
- authorization ambiguity;
- policy violations;
- unsupported or suspicious content.

Quarantine records retain source provenance and hashes but are not exposed to agents.

## AI safety boundary

Content retrieved from any source is data, not instructions. Prompt injection, embedded commands, hidden links, or social-engineering text inside acquired content must never grant capabilities or change connector permissions.

## Production gate

Do not enable autonomous production acquisition until these controls are implemented and tested:

- acquisition-run persistence;
- isolated artifact staging;
- malware/content/secret scanning;
- provenance and hashing;
- quotas and kill switches;
- incremental synchronization;
- authorization/revocation handling;
- human review queue;
- monitoring and audit events.
