# DKOS Universal Acquisition — Phase 2 Trust Boundary

## Status

Phase 2 defines a fail-closed lifecycle for content acquired through the Crawlee
foundation. It does **not** enable autonomous crawling, account connectors,
scheduling, credentials, production network access, or writes to an agent-facing
index.

## Source strategy

| Source | Acquisition path |
| --- | --- |
| Permitted public web pages | Crawlee behind the HTTPS/domain policy |
| Google Drive, Docs, and Sheets | Official Google APIs |
| GitHub repositories and account data | Official GitHub APIs |
| Local documents | Controlled filesystem ingestion |
| JavaScript-heavy permitted pages | Crawlee with an isolated browser when approved |

Crawlee is an acquisition component. DKOS remains the provenance, security,
classification, processing, approval, and agent-access plane.

## Lifecycle

```text
DISCOVERED -> SELECTED -> QUEUED -> ACQUIRED -> SCANNING
                                               |       |
                                               |       +-> APPROVED -> PROCESSED -> INDEXED
                                               +----------> QUARANTINED
```

Transitions cannot skip stages. Quarantine is terminal. A scan result is accepted
only while an object is in `SCANNING`.

## Required invariants

1. Every acquisition has a non-empty run ID, source type, and stable source object ID.
2. Credentials stay server-side and never become acquired content or crawler output.
3. All newly acquired content starts `UNTRUSTED`.
4. Original bytes remain in isolated staging before transformation.
5. A valid lowercase SHA-256 digest is required before processing or indexing.
6. Failed scans, missing hashes, malformed hashes, parser failures, and ambiguous
   results fail closed into `QUARANTINED`.
7. Quarantined objects remain untrusted and cannot be promoted by the state helper.
8. Only trusted, hashed, processed content is eligible for an agent-facing index.
9. Restricted content remains subject to the existing human-approval control.
10. No connector writes directly to an AI or vector index.
11. Every downstream artifact retains provenance to its acquisition and source object.
12. Jobs must be cancellable before production scheduling is enabled.

## Discovery-first operation

Account-scale sources first inventory metadata and estimate volume. Selection is
then bounded by folder, file type, date range, explicit object IDs, or quota.
Discovery never implies authorization to download all content.

Incremental synchronization uses stable remote IDs, version or modification
metadata, and content hashes. Deletion or permission loss is recorded as a
provenance event rather than silently erasing history.

## Production enablement gate

Autonomous acquisition remains disabled until all of the following are implemented
and tested:

- durable acquisition-run and transition persistence;
- isolated artifact staging with size and archive-expansion limits;
- malware, content, prompt-injection, and secret scanning;
- network egress enforcement and DNS-rebinding protection;
- provenance, hashing, deduplication, and incremental sync;
- quotas, cancellation, kill switches, monitoring, and audit events;
- authorization, revocation, and credential-rotation handling;
- human review and quarantine release workflows;
- explicit DKOS persistence and agent-access enforcement.

Acquired text is data, never executable instruction. Embedded prompts, commands,
links, or social-engineering content cannot grant capabilities or change connector
permissions.
