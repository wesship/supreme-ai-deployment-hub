# WAF Lifecycle Gate

This gate adds policy primitives for temporary Cloudflare WAF containment without introducing autonomous rollback or a second destructive API path.

## Included

- Default containment TTL: 1 hour.
- Minimum TTL: 60 seconds.
- Maximum TTL: 24 hours.
- Exact duplicate detection for enabled Cloudflare block rules.
- Deterministic expiry timestamps for audit metadata.
- Rollback audit coordinates containing ruleset ID, rule ID, target, actor ID, and rollback timestamp.

## Deliberately not included

- No scheduled or autonomous unblock worker.
- No public rollback endpoint.
- No new provider credential handling.
- No direct firewall deletion call.

The next provider-wiring gate can consume these primitives from the existing admin-approved execution path and must fail closed if the recorded rule coordinates are missing or no longer match the approved target.
