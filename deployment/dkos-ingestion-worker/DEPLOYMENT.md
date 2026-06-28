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
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PINECONE_API_KEY=
PINECONE_INDEX=devonn-rag
OPENAI_API_KEY=
HERMES_MEMORY_URL=
```

7. Deploy and copy the public service URL.

8. In the Vercel frontend project, set:

```text
VITE_DKOS_INGESTION_API_URL=https://your-dkos-worker.up.railway.app
```

9. Redeploy the Vercel frontend.

10. Test:

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

- Replace in-memory run storage with Supabase tables.
- Add object storage for uploaded files and artifacts.
- Add queue execution instead of synchronous processing.
- Add authentication and tenant authorization.
- Add file-size limits.
- Add malware scanning.
- Add parser sandboxing.
- Add signed artifact URLs.
- Add audit logs.
