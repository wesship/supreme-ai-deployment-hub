# DKOS Ingestion API Contract

This contract defines the API surface for the server-side DKOS ingestion worker. The Vite frontend should call these endpoints through the backend, not run Docling or MarkItDown in the browser.

## Base path

```text
/api/dkos/ingestion
```

## Start ingestion

```http
POST /api/dkos/ingestion/runs
Content-Type: multipart/form-data
```

### Form fields

| Field | Required | Description |
|---|---:|---|
| `file` | Yes | Source document to ingest. |
| `tenant_id` | Yes | Workspace or tenant id. |
| `uploaded_by` | Yes | User id or service principal id. |
| `classification` | No | `public`, `internal`, `confidential`, or `restricted`. |
| `agent_access` | No | Comma-separated agent names allowed to retrieve the document. |

### Response

```json
{
  "run_id": "uuid",
  "document_id": "uuid",
  "status": "pending",
  "current_stage": "upload"
}
```

## Get ingestion status

```http
GET /api/dkos/ingestion/runs/{run_id}
```

### Response

```json
{
  "run_id": "uuid",
  "status": "running",
  "current_stage": "markitdown",
  "stages": [
    { "stage": "upload", "status": "completed" },
    { "stage": "docling", "status": "completed" },
    { "stage": "markitdown", "status": "running" }
  ],
  "artifacts": []
}
```

## List artifacts

```http
GET /api/dkos/ingestion/runs/{run_id}/artifacts
```

### Response

```json
{
  "run_id": "uuid",
  "artifacts": [
    { "kind": "markdown", "path": "document.md", "content_type": "text/markdown" },
    { "kind": "chunks", "path": "chunks.jsonl", "content_type": "application/jsonl" },
    { "kind": "knowledge_graph", "path": "knowledge_graph.json", "content_type": "application/json" }
  ]
}
```

## Recommended backend execution model

1. Upload request creates an ingestion run.
2. File is stored in isolated temporary object storage.
3. Queue job starts.
4. Worker executes each stage.
5. Artifacts are written to object storage.
6. Metadata is written to Supabase.
7. Chunks and embeddings are written to Pinecone.
8. Hermes memory index is updated.
9. Status endpoint returns completed run.

## Error handling

A failed run should preserve partial artifacts and mark the failed stage.

```json
{
  "run_id": "uuid",
  "status": "failed",
  "current_stage": "docling",
  "error": "Parser failed: unsupported encrypted PDF"
}
```

## Security requirements

- Enforce tenant isolation.
- Enforce file size limits.
- Hash every uploaded file.
- Keep service keys server-side only.
- Never expose object-storage signed URLs longer than necessary.
- Log parser chain and artifact hashes.
- Require human approval for restricted documents before agent access.
