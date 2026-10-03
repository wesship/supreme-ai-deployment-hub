# D3VONN Hosting Control Plane

D3VONN is designed as a provider-agnostic hosting control plane. `d3vonn.io` is the initial platform domain, not a permanent dependency.

## Core rule

Never couple a project, deployment, certificate, or customer identity directly to a root domain or infrastructure vendor.

Use stable internal IDs:

- `project_id`
- `deployment_id`
- `domain_id`
- `provider_id`
- `zone_id`

Domains and providers are bindings that can be changed independently.

## Domain model

A project can have multiple domain bindings:

```text
Project
  -> Deployment
  -> platform hostname: my-app.d3vonn.io
  -> custom hostname: app.customer.com
  -> future platform hostname: my-app.new-domain.tld
```

Recommended domain record fields:

```text
id
project_id
hostname
mode                 # platform-subdomain | custom-domain
zone_id
status               # pending | verifying | active | failed | disabled
verification_method  # dns-txt | cname | http
verification_token
certificate_status
created_at
verified_at
```

A root-domain migration therefore changes the active zone and creates new bindings; it does not rename projects or deployments.

## Domain zones

Treat every root domain as a zone record:

```text
zone_id
root_domain
dns_provider
wildcard_enabled
custom_domains_enabled
status
```

Initial zone:

```text
root_domain = d3vonn.io
dns_provider = cloudflare
wildcard = *.d3vonn.io
```

A future domain can be added beside it, tested, and promoted without removing `d3vonn.io`.

## Provider adapters

Hosting providers implement the same logical contract:

```text
deploy(project, build)
getDeployment(id)
attachDomain(deployment, hostname)
detachDomain(deployment, hostname)
getLogs(deployment)
healthCheck(deployment)
deleteDeployment(deployment)
```

Initial adapters may target Vercel and Railway. `self-hosted` is a first-class adapter so D3VONN can later move workloads to its own Docker/Kubernetes infrastructure without changing the public control-plane API.

DNS providers use a separate contract:

```text
createRecord(zone, record)
updateRecord(zone, record)
deleteRecord(zone, record)
verifyRecord(zone, record)
```

This separation allows Cloudflare DNS + Railway hosting, Route53 DNS + self-hosting, or any future combination.

## Environment configuration

The frontend/control plane reads:

```text
VITE_PLATFORM_ROOT_DOMAIN=d3vonn.io
VITE_HOSTING_PROVIDER=vercel
VITE_DNS_PROVIDER=cloudflare
```

Changing the active root domain must be a configuration operation, not a source-code rewrite.

## Wildcard routing

For platform subdomains, configure one wildcard record:

```text
*.d3vonn.io -> platform ingress
```

The ingress resolves the hostname to a project/deployment mapping. Do not create a separate DNS record for every free subdomain unless the selected provider requires it.

Reserved names should include at least:

```text
www
api
admin
app
auth
status
cdn
assets
mail
smtp
stream
```

## Migration strategy

To move from `d3vonn.io` to another platform domain:

1. Add the new domain as a domain zone.
2. Configure its wildcard DNS and TLS.
3. Generate parallel project bindings on the new zone.
4. Verify deployments through both domains.
5. Change `activeDomainZone`.
6. Redirect the old platform hostnames if desired.
7. Keep customer custom domains unchanged.

This provides a zero-project-rename migration path.

## Scale path

### Phase 1

Use third-party hosting adapters and wildcard platform domains.

### Phase 2

Add durable database-backed project, deployment, domain, certificate, build and audit records.

### Phase 3

Add queues and stateless deployment workers. Domain verification and certificate provisioning must run as idempotent jobs.

### Phase 4

Add the self-hosted provider: container registry, scheduler, ingress, object storage, observability and automated TLS.

### Phase 5

Optionally add registrar/reseller APIs. Registration of public ICANN domains remains separate from free D3VONN subdomain issuance and incurs registry/registrar costs.

## End-to-end gate

```text
Create project
 -> allocate stable project ID
 -> build
 -> provider adapter deploy
 -> allocate <slug>.<active-zone>
 -> wildcard/ingress route
 -> TLS
 -> health check
 -> publish deployment ACTIVE
```

The gate is GREEN only when the generated HTTPS project URL resolves and the deployed application passes its health check.
