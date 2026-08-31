# Crawlee Universal Data Acquisition

## Decision

D3VONN.IO will use the open-source Crawlee Python library as the web acquisition engine. Crawlee is self-hostable and Apache-2.0 licensed. It is an acquisition component, not the DKOS ingestion system.

Official project: https://crawlee.dev/

## Scope

Crawlee is for authorized web sources and permitted public web collection. Account data should use official APIs/connectors whenever available:

- Google Drive / Docs / Sheets: official Google APIs
- GitHub: GitHub API
- Local Downloads/Documents: filesystem ingestion
- Web pages and permitted web resources: Crawlee
- JavaScript-heavy permitted sites: optional Playwright-backed Crawlee crawler

## Trust boundary

```text
Authorized source
      -> acquisition policy
      -> Crawlee
      -> UNTRUSTED acquisition record
      -> DKOS security scan
      -> classification
      -> quarantine / approval
      -> Docling / MarkItDown / OCR
      -> artifact store
      -> Supabase metadata
      -> embeddings / knowledge graph / Hermes
      -> agent access policy
```

Crawlee output is never treated as trusted instructions. Web content can contain prompt injection, malicious links, secrets, or misleading data. The acquisition record must remain `untrusted` until the DKOS security pipeline completes.

## Safety requirements

1. HTTPS by default.
2. Explicit domain allowlist for every crawl job.
3. No arbitrary user-supplied outbound destination from an agent.
4. No credential collection or storage in the crawler.
5. Per-job request and crawl-depth limits.
6. External links are rejected unless their destination is allowlisted.
7. Acquisition records include a unique acquisition ID and source URL.
8. Content proceeds to DKOS security scanning before parsing/indexing/agent access.
9. Restricted content requires human approval before agent access, consistent with the existing DKOS contract.
10. Crawling must respect applicable authorization, robots directives, terms, rate limits, and other legal/policy constraints.
11. Crawler jobs need cancellation/kill-switch support before production rollout.\n13. Production rollout also requires network-layer egress enforcement and DNS-resolution checks to prevent DNS rebinding into private or reserved address space.
12. Credentials remain in server-side secret management and never enter crawler output.

## Existing DKOS integration

The existing DKOS ingestion contract already provides tenant isolation, classification, isolated temporary storage, file hashing, artifact hashes, short-lived signed URLs, and human approval for restricted documents. This connector feeds that existing pipeline instead of creating a second ingestion system.

## Rollout

### Phase 1 — safe foundation

- Add Crawlee dependency.
- Add allowlist policy and acquisition record model.
- Add unit tests for URL policy and cross-domain rejection.
- Keep connector disabled by default.

### Phase 2 — DKOS wiring

- Create acquisition-run records.
- Stream/download approved artifacts into isolated temporary storage.
- Apply malware/content/secret scanning.
- Attach source provenance and hashes.
- Feed approved documents to the existing DKOS worker.

### Phase 3 — account connectors

Implement official API connectors for the user's authorized accounts. Discovery should inventory first, estimate volume, then allow selective or full synchronization.

### Phase 4 — production controls

Add scheduling, incremental synchronization, content hashing/deduplication, quotas, retention policies, kill switches, monitoring, and human review queues.

## Non-goals

- Circumventing authentication or access controls.
- Bypassing robots/terms/policies.
- Scraping private accounts without explicit authorization.
- Storing third-party credentials in crawler jobs.
- Giving AI agents unrestricted network access.
