# DKOS Ingestion Worker Deployment

This guide deploys the DKOS ingestion worker as a separate backend service for D3VONN.IO.

## Why separate service

The worker uses Python document tooling such as MarkItDown and Docling. These tools must stay server-side and should not be bundled into the Vite frontend.

## Railway deployment

1. Create a new Railway service.
2. Connect the `wesship/supreme-ai-deployment-hub` repository.
3. Set the service root to the repository root.
4. Use Dockerfile path:

```text
deployment/dkos-ingestion-worker/Dockerfile
```

5. Use health check path:

```text
/health
```

6. Add environment variables:

```text
PINECONE_API_KEY=
PINECONE_INDEX=devonn-rag
OPENAI_API_KEY=
DKOS_SERVICE_KEY=<strong-random-shared-secret>
DKOS_SOURCE_HOST_ALLOWLIST=your-storage.example.com
CLIENT_AI_MEMORY_COMMIT_URL=https://api.d3vonn.io/api/client-ai/memory/commits
CLIENT_AI_MEMORY_COMMIT_SECRET=<strong-random-shared-secret>
DKOS_EMBEDDING_MODEL=text-embedding-3-small
# Optional when your Pinecone index uses a non-default dimension:
# DKOS_EMBEDDING_DIMENSIONS=1536
# Optional when Docling is installed in the image:
# DKOS_ENABLE_DOCLING=true
```

7. Deploy and copy the public service URL.

8. In the Vercel frontend project, set:

```text
VITE_DKOS_INGESTION_API_URL=https://your-dkos-worker.up.railway.app
```

9. On the main D3VONN FastAPI/Hermes deployment, configure:

```text
DKOS_INGESTION_SERVICE_URL=https://your-dkos-worker.up.railway.app/api/dkos/ingestion/sources
DKOS_SERVICE_KEY=<same DKOS_SERVICE_KEY used by the worker>
CLIENT_AI_MEMORY_COMMIT_SECRET=<same memory secret used by the worker>
OPENAI_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX=devonn-rag
```

10. Apply the Client AI migrations, including `client_ai_memory_commits`, before enabling customer ingestion.

11. Redeploy the Vercel frontend and FastAPI/Hermes services.

12. Test:

```text
https://your-dkos-worker.up.railway.app/health
https://d3vonn.io/dkos-ingestion
```

## AWS deployment

Recommended AWS path:

1. Build Docker image.
2. Push to Amazon ECR.
3. Deploy with ECS Fargate or App Runner.
4. Add service environment variables.
5. Expose HTTPS endpoint through ALB/App Runner domain.
6. Set Vercel variable:

```text
VITE_DKOS_INGESTION_API_URL=https://your-aws-dkos-service.example.com
```

7. Optional: set status health variable:

```text
VITE_AWS_HEALTH_URL=https://your-aws-dkos-service.example.com/health
```

## API checks

Health:

```bash
curl https://YOUR_WORKER_URL/health
```

Start ingestion:

```bash
curl -X POST https://YOUR_WORKER_URL/api/dkos/ingestion/runs \
  -F "file=@sample.pdf" \
  -F "tenant_id=default-workspace" \
  -F "uploaded_by=operator" \
  -F "classification=internal"
```

## Production hardening before customer data

The Client AI service path now requires service authentication, exact HTTPS source-host allowlisting, tenant-isolated Pinecone namespaces, file-size enforcement, and a service-authenticated memory commit callback. Before broad customer rollout:

- Replace the DKOS worker's in-memory run-status cache with durable persistence.
- Prefer private object storage and short-lived signed source URLs on an allowlisted storage hostname.
- Add malware scanning and parser sandboxing for untrusted binary documents.
- Keep `DKOS_SERVICE_KEY` and `CLIENT_AI_MEMORY_COMMIT_SECRET` server-side only and rotate them on a defined schedule.
- Keep the Pinecone index namespace contract as `tenant:<client-ai tenant id>`; never use the default namespace for Client AI data.
- Confirm the memory commit migration is applied before enabling `CLIENT_AI_MEMORY_COMMIT_URL`.
- Monitor failed/manual-review stages and retain audit records for source hash, chunk hash, vector receipt, and Hermes memory commit id.
