# D3VONN Production Verification Checklist

This checklist controls the D3VONN private beta gate. Do not mark a gate green unless there is live proof from production, logs, Sentry, or the relevant provider dashboard.

## Locked Release Status

```text
🟡 Production verification pending
🔒 Private beta: NOT YET APPROVED
```

## Current Sentry Status

```text
✅ Sentry DSN in Vercel: PASS
✅ Production redeploy after DSN: PASS
✅ Sentry SDK present on live frontend: PASS
✅ Sentry project ingest works: PASS
🟡 Live browser-origin frontend event: PENDING
```

Sentry is code-ready and platform-ready, but it is not fully green until a live browser-origin event appears in Sentry Issues or Events.

Required event marker:

```text
DEVONN_SENTRY_PROD_TEST_
```

## Browser-Origin Sentry Test

Use a clean browser path:

1. Open Chrome or Edge in Incognito / Private mode.
2. Disable extensions, ad blockers, privacy blockers, VPN, and tracking protection for the test.
3. Visit `https://d3vonn.io`.
4. Open DevTools → Console.
5. Run:

```js
setTimeout(() => {
  throw new Error("DEVONN_SENTRY_PROD_TEST_" + Date.now());
}, 1000);
```

6. Wait 30–90 seconds.
7. Open the D3VONN frontend project in Sentry.
8. Search Issues or Events for:

```text
DEVONN_SENTRY_PROD_TEST_
```

Green condition:

```text
✅ Live browser-origin frontend event: PASS
✅ Sentry lane: GREEN
```

Do not change repository code for Sentry unless this test reveals a new confirmed frontend/runtime error.

## Backend Health Verification

The backend must be verified against live production routing. Test both the runbook route family and the canonical FastAPI route family.

### Runbook route family

```bash
curl -i https://api.d3vonn.io/status/health
curl -i https://api.d3vonn.io/status/health/deep
curl -i https://api.d3vonn.io/status/dns-status
```

### Canonical FastAPI route family

```bash
curl -i https://api.d3vonn.io/health
curl -i https://api.d3vonn.io/health/deep
curl -i https://api.d3vonn.io/ready
```

Green conditions:

```text
✅ Backend shallow health returns HTTP 200
✅ Backend deep health returns HTTP 200
✅ Production API routing resolves through the intended domain
```

Expected deep health service state:

```text
api: healthy
supabase: configured
openai: configured
pinecone: configured
```

If one route family passes and the other fails, record which route is canonical for production and update the deployment runbook to remove ambiguity.

## AI Billing / Credits Verification

Confirm inside the AI provider dashboard that production keys have active billing or credits.

Green conditions:

```text
✅ OpenAI or active AI provider billing is enabled
✅ Production key is valid
✅ A real model request succeeds from production backend
```

Recommended verification flow:

```bash
curl -i https://api.d3vonn.io/health/deep
```

Then run one real chat or agent request from the D3VONN frontend and verify no quota, billing, or authentication error appears.

## Live End-to-End Flow

A private beta cannot be approved until one real production user flow succeeds.

Minimum flow:

1. Visit `https://d3vonn.io`.
2. Log in or enter the main app flow.
3. Submit a real chat/agent request.
4. Confirm the backend responds successfully.
5. Confirm no frontend crash appears.
6. Confirm no backend 500 appears.
7. Confirm Sentry does not show a new critical error from the flow.

Green condition:

```text
✅ One live production end-to-end user flow: PASS
```

## Private Beta Approval Rule

Only approve private beta when all of these are green:

```text
✅ Frontend production URL reachable
✅ Sentry lane green
✅ Backend shallow health green
✅ Backend deep health green
✅ AI billing / credits active
✅ One live end-to-end user flow green
```

Final approval state:

```text
✅ Private beta: APPROVED
```

Until then:

```text
🔒 Private beta: NOT YET APPROVED
```
