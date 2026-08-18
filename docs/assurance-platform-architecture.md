# D3VONN.IO Assurance Platform Architecture

## Purpose

The assurance platform is a secure operational control plane for the D3VONN.IO public surface. It consolidates canonical SEO validation, route metadata checks, CSP reporting, MCP gateway governance, performance and accessibility audits, enterprise readiness, status transparency, and remediation tracking.

## Trust boundaries

Public trust content is static and server-visible. The public security disclosure policy, `/.well-known/security.txt`, sitemap, robots file, canonical tags, and route HTML are generated from one canonical-host configuration during the frontend build.

The assurance dashboard and MCP management controls are authenticated server-side. The browser never decides which MCP gateway may be contacted, never submits a raw destination URL for execution, and never receives a credential that can bypass the backend control plane.

## Canonical rendering model

The canonical serving host is `https://www.d3vonn.io`. A single route registry is the source for sitemap entries, crawler instructions, initial HTML titles, descriptions, canonical URLs, Open Graph tags, structured data, and server-side metadata validation. The apex host remains a permanent redirect only.

The build emits a static, route-specific HTML document for every indexed page. This keeps title, canonical, description, and social metadata available in the initial HTTP response before application hydration.

## CSP model

Vercel Routing Middleware generates one cryptographically random nonce per HTML request and emits both an enforced `Content-Security-Policy` header and a report-only policy during the transition period. The production policy excludes `unsafe-eval` and blanket `unsafe-inline`.

Static external scripts use `self`; any future inline script or style must be emitted by a server-aware route with the request nonce. CSP reports are sent only to the backend report endpoint, schema-validated, rate-limited, redacted, and stored as security events.

## MCP execution model

The MCP page requires authentication. Gateway records are pre-registered with an owner, display name, immutable normalized origin, approved status, and optional expiration. Agent execution accepts a gateway record ID, not a URL.

Before any outbound connection, the backend validates the scheme, resolves all DNS records, rejects loopback, private, link-local, multicast, unspecified, reserved, and non-global addresses, then connects only through a controlled HTTP client with redirects disabled. The peer address is checked again after resolution immediately before use. Every execution attempt produces an append-only audit record, including allow/deny reason and request correlation ID. The route is rate-limited per authenticated principal and per gateway.

## Operational data model

The Supabase migration adds tables for `assurance_gateway_registry`, `assurance_mcp_audit_log`, `assurance_csp_reports`, `assurance_route_audits`, `assurance_accessibility_audits`, `assurance_performance_samples`, `assurance_incidents`, `assurance_maintenance_windows`, `assurance_status_subscriptions`, and `assurance_remediation_items`. Row-level security permits public reads only for resolved public status/incidents/maintenance data. All management and audit data remain server-admin controlled.

## Measurement model

The browser sends RUM Web Vitals using `navigator.sendBeacon` to an endpoint that accepts only the LCP, INP, and CLS metrics with route and deployment context. Synthetic checks run only through an authenticated scheduler or CI workflow and write the same durable sample format. The dashboard derives route budgets and blocking dependency observations from these records rather than from client-side guesses.

Accessibility runs in CI or a controlled server job using axe-core against a known route registry. The public UI only renders persisted findings and WCAG 2.2 AA pass/fail summaries; it never launches arbitrary URL scans.

## Deployment requirements

The deployment must set `CANONICAL_SITE_ORIGIN=https://www.d3vonn.io`, `ASSURANCE_ADMIN_IDS`, `MCP_AUDIT_RETENTION_DAYS`, and an outbound-gateway allowlist through managed secrets. An email delivery provider must be configured before email status subscriptions are enabled. Webhook subscriptions are only activated after a server-side ownership challenge and are delivered with an HMAC signature.
