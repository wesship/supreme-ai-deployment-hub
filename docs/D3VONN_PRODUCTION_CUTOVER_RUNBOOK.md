# D3VONN.IO Production Cutover Runbook

This runbook documents the repeatable DNS, SSL, Nginx, API, websocket, and rollback checks for moving `d3vonn.io` and `api.d3vonn.io` onto the Hostinger VPS production stack.

## Scope

Use this when cutting production traffic to the VPS stack in `deploy/vps/`.

Primary domains:

- `d3vonn.io`
- `www.d3vonn.io`
- `api.d3vonn.io`

Primary Nginx files:

- `deploy/vps/nginx/nginx.conf`
- `deploy/vps/nginx/conf.d/d3vonn.conf`

## Pre-cutover checklist

Before changing DNS, confirm the VPS stack is ready.

```bash
cd /opt/d3vonn/supreme-ai-deployment-hub
git pull origin main

docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env config >/tmp/d3vonn-compose-check.yml

docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env ps
```

Expected result:

- Docker Compose config renders without errors.
- Backend, frontend/Nginx, Redis, and worker containers are either already healthy or ready to start.
- `deploy/vps/.env` contains production values, not placeholders.

## Nginx websocket map verification

The API virtual host uses `$connection_upgrade` for `/ws/` traffic. That variable must be defined in the main Nginx `http` block.

Verify this block exists in `deploy/vps/nginx/nginx.conf`:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

Then verify the websocket route in `deploy/vps/nginx/conf.d/d3vonn.conf` keeps these headers:

```nginx
location /ws/ {
    proxy_pass http://backend_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
}
```

If the map is missing, Nginx can fail config validation or websocket upgrades can break.

## DNS cutover

At the DNS provider, point the production records to the VPS public IPv4 address.

Recommended records:

| Host | Type | Value |
| --- | --- | --- |
| `@` | `A` | `<VPS_PUBLIC_IPV4>` |
| `www` | `A` | `<VPS_PUBLIC_IPV4>` |
| `api` | `A` | `<VPS_PUBLIC_IPV4>` |

Optional IPv6 records may be added only if the VPS has stable IPv6 configured.

Before cutover, lower TTL if your DNS provider allows it:

```text
TTL: 300 seconds
```

After updating DNS, verify resolution:

```bash
dig +short d3vonn.io
dig +short www.d3vonn.io
dig +short api.d3vonn.io
```

Expected result: all three return the VPS public IP.

## HTTP bootstrap check

Before issuing SSL, port 80 must respond for ACME challenges.

```bash
curl -I http://api.d3vonn.io/health
curl -I http://d3vonn.io/health
```

Expected result:

- `api.d3vonn.io/health` returns HTTP successfully before redirect behavior blocks ACME.
- `d3vonn.io/health` returns HTTP successfully.
- Firewall allows ports `80` and `443`.

Firewall check:

```bash
sudo ufw status verbose
```

Expected allowed ports:

- `80/tcp`
- `443/tcp`
- SSH port currently used for server access

## SSL issuance

Run the SSL initialization script from the VPS deploy directory:

```bash
cd /opt/d3vonn/supreme-ai-deployment-hub/deploy/vps
sudo bash ssl/init-ssl.sh
```

Expected certificate paths inside the Nginx container:

```text
/etc/nginx/ssl/live/api.d3vonn.io/fullchain.pem
/etc/nginx/ssl/live/api.d3vonn.io/privkey.pem
```

The compose mount maps local certificates into the Nginx container. If SSL issuance fails, check:

```bash
docker compose -f docker-compose.yml --env-file .env logs nginx
sudo ls -la ssl/certs/live/
```

## Start or restart production stack

```bash
cd /opt/d3vonn/supreme-ai-deployment-hub

docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env up -d --build

docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env ps
```

Validate Nginx config inside the running container:

```bash
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env exec nginx nginx -t
```

Expected result:

```text
syntax is ok
test is successful
```

## Production verification

Run these checks after DNS and SSL are active.

```bash
curl -I https://d3vonn.io
curl -I https://www.d3vonn.io
curl -I https://api.d3vonn.io/health
curl -sS https://api.d3vonn.io/health
```

Expected result:

- Frontend responds over HTTPS.
- API health endpoint responds over HTTPS.
- No certificate mismatch.
- No browser mixed-content warnings.

If the backend exposes deeper health endpoints, run:

```bash
curl -sS https://api.d3vonn.io/health/live
curl -sS https://api.d3vonn.io/health/ready
```

## Websocket verification

Use this only after HTTPS is working.

```bash
curl -i \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: api.d3vonn.io" \
  -H "Origin: https://d3vonn.io" \
  https://api.d3vonn.io/ws/
```

A websocket endpoint may return a protocol-specific error if the request is not a full websocket client handshake, but it should not fail because of an undefined Nginx variable or bad TLS termination.

For a full client check, use a websocket client from your workstation:

```bash
npx wscat -c wss://api.d3vonn.io/ws/
```

Expected result:

- TLS handshake succeeds.
- Nginx forwards upgrade headers.
- Backend receives the websocket request.

## Frontend API cutover

Confirm the production frontend is using the production API URL:

```text
VITE_API_URL=https://api.d3vonn.io
```

Then rebuild/redeploy the frontend container:

```bash
cd /opt/d3vonn/supreme-ai-deployment-hub

docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env up -d --build frontend nginx
```

Browser verification:

1. Open `https://d3vonn.io`.
2. Open browser dev tools.
3. Confirm API calls go to `https://api.d3vonn.io`.
4. Confirm no calls go to localhost, preview, staging, or old Railway/Vercel backend URLs unless intentionally configured.

## Observability checks

```bash
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env logs --tail=100 nginx
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env logs --tail=100 backend
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env logs --tail=100 redis
```

Watch for:

- `502 Bad Gateway`
- `504 Gateway Timeout`
- SSL certificate file errors
- CORS errors
- Backend import/startup errors
- Redis connection failures
- Websocket upgrade errors

## Acceptance criteria

Production cutover is complete when all are true:

- `d3vonn.io` resolves to the VPS.
- `www.d3vonn.io` resolves to the VPS.
- `api.d3vonn.io` resolves to the VPS.
- HTTPS certificates are valid for the expected domains.
- `https://api.d3vonn.io/health` returns healthy.
- Frontend loads at `https://d3vonn.io`.
- Frontend API requests use `https://api.d3vonn.io`.
- Websocket upgrade path does not fail because of Nginx config.
- Nginx config passes `nginx -t`.
- Logs do not show repeated 5xx errors after live traffic begins.

## Rollback plan

If production traffic fails after DNS cutover, use the fastest safe rollback.

### Option A: DNS rollback

Point records back to the previous known-good hosting target.

```text
@      A/CNAME  <previous_target>
www    A/CNAME  <previous_target>
api    A/CNAME  <previous_api_target>
```

Use this when the VPS stack is unhealthy and the previous platform is still serving production.

### Option B: Git rollback on VPS

Use this when DNS and SSL are good but the latest app release is bad.

```bash
cd /opt/d3vonn/supreme-ai-deployment-hub
git log --oneline -n 20
git checkout <known-good-commit>
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env up -d --build
bash deploy/vps/scripts/healthcheck.sh
```

Return to `main` after the fix is merged:

```bash
git checkout main
git pull origin main
```

### Option C: Disable only API traffic

If the frontend is healthy but API is unstable, temporarily route API traffic back to the previous API host at DNS or reverse proxy level while keeping the frontend live.

Document the temporary state clearly before making more changes.

## Post-cutover cleanup

After production is stable:

- Raise DNS TTL from `300` to the normal value.
- Confirm SSL auto-renewal is configured.
- Confirm backups are running.
- Confirm monitoring/alerts are enabled.
- Remove any temporary staging redirects.
- Record the cutover date, commit SHA, VPS IP, and rollback target in the release notes.
