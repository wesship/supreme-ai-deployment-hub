# Hardened Persistent IPython Kernel Gateway

This optional service gives n8n workflows persistent in-memory Python state without executing Python inside n8n worker containers.

## Security model

The gateway is deliberately fail-closed:

- every management and execution request requires `Authorization: Bearer <KERNEL_GATEWAY_API_TOKEN>`
- every kernel receives a random per-session capability token at creation time
- `/execute` and `DELETE /sessions/{id}` also require `X-Session-Token`
- session identifiers are validated and bounded
- code payload, output size, concurrent sessions, execution time, and idle lifetime are bounded
- executions within one kernel are serialized
- Jupyter messages are correlated to the initiating execution message ID
- stdin is disabled
- stale kernels are terminated automatically
- the container runs as fixed non-root UID/GID 10001, with a read-only filesystem, dropped Linux capabilities, no-new-privileges, PID/memory/CPU limits, and tmpfs-only writable paths
- the gateway port is not published to the host
- the gateway sits only on an internal Docker network; n8n receives a separate egress network
- n8n image selection must be supplied explicitly instead of silently tracking `latest`

This is defense in depth, not a hostile-code sandbox. Arbitrary Python still runs inside the gateway container. Do not inject untrusted model/user text directly as executable Python. For hostile or multi-tenant code, use stronger per-execution isolation such as a dedicated container/VM sandbox with an outbound network policy.

## n8n flow

### 1. Create a session

`POST http://python-kernel-gateway:8000/sessions/create/{{ $execution.id }}`

Headers:

- `Authorization: Bearer {{$env.KERNEL_GATEWAY_API_TOKEN}}`

The response contains `session_token`. Preserve that value in the workflow and do not log it.

### 2. Execute code

`POST http://python-kernel-gateway:8000/execute`

Headers:

- `Authorization: Bearer {{$env.KERNEL_GATEWAY_API_TOKEN}}`
- `X-Session-Token: <session_token returned by create>`

JSON body:

```json
{
  "session_id": "={{ $execution.id }}",
  "code": "import pandas as pd\ndata = {'metric': ['CPU', 'RAM', 'GPU'], 'value': [12, 84, 95]}\ndf = pd.DataFrame(data)\nprint('Data ingested into kernel memory.')"
}
```

Subsequent execute nodes can reuse the same session and token, so variables such as `df` remain in RAM.

### 3. Destroy the session

`DELETE http://python-kernel-gateway:8000/sessions/{{ $execution.id }}`

Send both authentication headers. Put cleanup on the workflow error/finalization path as well as the normal success path. Idle cleanup is a backstop, not the primary lifecycle mechanism.

## Deployment

Copy `kernel-gateway/.env.example` values into your secret-management system. Never commit real gateway tokens, n8n encryption keys, database passwords, or credentials.

Run the optional stack/profile with the repository's `docker-compose.kernel-gateway.yml`. The kernel gateway intentionally has no host `ports:` mapping.
