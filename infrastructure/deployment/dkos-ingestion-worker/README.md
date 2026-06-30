# DKOS Ingestion Worker

This worker is the server-side runtime for document conversion and DKOS memory ingestion.

It is intentionally separated from the Vite frontend so Python document tools such as Docling and MarkItDown do not increase browser bundle size.

## Responsibilities

- Receive ingestion jobs from the backend queue.
- Validate source file metadata.
- Run security checks.
- Run OCR when needed.
- Run Docling for layout-aware parsing.
- Run MarkItDown for Markdown normalization.
- Clean Markdown.
- Extract metadata.
- Generate knowledge graph candidates.
- Create semantic chunks.
- Create embedding manifests.
- Write vectors to Pinecone.
- Write metadata and audit logs to Supabase.
- Notify Hermes memory when ingestion completes.

## Local installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r ../dkos-ingestion-requirements.txt
```

## Worker command

```bash
python worker.py
```

## Required runtime variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `OPENAI_API_KEY`
- `HERMES_MEMORY_URL`

## Notes

Docling and MarkItDown should run in an isolated worker runtime with strict file-size limits and temporary file cleanup.
