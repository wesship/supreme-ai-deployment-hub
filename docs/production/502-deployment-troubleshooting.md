# HTTP 502 Deployment Troubleshooting

The production hardening rollout is **not complete** while any public API endpoint returns `502 Bad Gateway` or while `/health/ready` does not return HTTP 200.

Use this procedure before making another deployment change.

## 1. Confirm the deployed Git state

Run on the VPS:

```bash
cd /opt/supreme-ai-deployment-hub

git status
git log -1 --oneline
```

Confirm the checkout is on the intended production branch and contains the expected merge commit.

## 2. Inspect Docker Compose service status

```bash
docker compose \
  --env-file deploy/vps/env/.env.production \
  -f deploy/vps/docker-compose.yml \
  ps

docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Look for:

- Missing or exited backend and Nginx containers
- Restart loops
- Unhealthy containers
- Unexpected host port mappings

## 3. Inspect the backend container

```bash
docker logs --tail=150 d3vonn-backend
docker inspect d3vonn-backend --format '{{json .State.Health}}'
```

Do not continue until startup errors, import failures, environment errors, or health-check failures are understood.

## 4. Test the backend directly from the VPS host

```bash
curl -i http://127.0.0.1:8000/health
curl -i http://127.0.0.1:8000/health/ready
```

Interpretation:

- Connection refused usually means the backend is not listening or the container is not running.
- HTTP 500 indicates an application error that must be inspected in backend logs.
- HTTP 503 from readiness identifies a critical dependency that is unavailable.
- HTTP 200 confirms the backend process is reachable from the VPS host.

## 5. Test backend reachability from inside Nginx

```bash
docker exec d3vonn-nginx wget -S -O- http://backend:8000/health
docker exec d3vonn-nginx wget -S -O- http://backend:8000/health/ready
```

If host-level checks pass but these commands fail, investigate:

- Docker networks
- The Compose service name
- Backend container DNS resolution
- Whether Nginx and backend share `d3vonn-internal`
- The backend listening address and port

## 6. Compare active and host Nginx configuration

Inspect the configuration loaded by the running container:

```bash
docker exec d3vonn-nginx nginx -T 2>&1 | grep -E \
'Strict-Transport|Content-Security|Permissions-Policy|Referrer-Policy|proxy_pass'
```

Inspect the configuration stored on the VPS host:

```bash
grep -E \
'Strict-Transport|Content-Security|Permissions-Policy|Referrer-Policy|proxy_pass' \
deploy/vps/nginx/conf.d/d3vonn.conf
```

If the host file contains the expected headers or proxy target but `nginx -T` does not, the running Nginx container is using stale configuration.

## 7. Recreate and reload Nginx when configuration is stale

```bash
docker compose \
  --env-file deploy/vps/env/.env.production \
  -f deploy/vps/docker-compose.yml \
  up -d --force-recreate nginx

docker exec d3vonn-nginx nginx -t
docker exec d3vonn-nginx nginx -s reload
```

Re-run the internal backend tests and public endpoint tests after recreation.

## 8. Verify public recovery

```bash
curl -i https://api.d3vonn.io/health/live
curl -i https://api.d3vonn.io/health/ready
curl -i https://api.d3vonn.io/api/health
curl -i https://api.d3vonn.io/api/health/ready
```

The rollout is complete only when:

- Public endpoints no longer return 502.
- `/health/live` returns HTTP 200.
- `/health/ready` returns HTTP 200.
- The active Nginx response contains the intended security headers.
- Backend, Nginx, Redis, Hermes, and worker containers are stable.

## Most important diagnostic output

Collect these three outputs before the next deployment change:

```bash
docker compose \
  --env-file deploy/vps/env/.env.production \
  -f deploy/vps/docker-compose.yml \
  ps

docker logs --tail=100 d3vonn-backend
docker exec d3vonn-nginx wget -S -O- http://backend:8000/health
```

Do not paste real secrets, tokens, authorization headers, cookies, or full production connection strings into issues, pull requests, chat, or logs shared for troubleshooting.
