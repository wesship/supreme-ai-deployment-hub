# DKOS Ingestion Pipeline

D3VONN.IO uses a document-intelligence ingestion pipeline to convert raw business files into structured memory for Hermes and the AI workforce.

## Purpose

The goal is to make every uploaded asset searchable, connected, chunked, embedded, and available to agents through DKOS.

## Recommended pipeline

```text
Upload
  -> Security scan
  -> File classification
  -> OCR when needed
  -> Docling
  -> MarkItDown
  -> Markdown cleanup
  -> Metadata extraction
  -> Knowledge graph generation
  -> Semantic chunking
  -> Embedding generation
  -> Pinecone vector storage
  -> Hermes memory
  -> DKOS retrieval
  -> Agent workforce access
```

## Why Docling before MarkItDown

Docling should run first when a source document has layout, tables, figures, scanned pages, or complex document structure.

Docling is responsible for preserving high-fidelity document structure before the content is normalized.

## Why MarkItDown after Docling

MarkItDown should convert the structured document output into clean Markdown that is easier for LLMs, semantic chunkers, embeddings, retrieval, and long-term memory.

Markdown becomes the canonical lightweight representation inside DKOS.

## Supported input classes

- PDF documents
- Word documents
- PowerPoint decks
- Excel spreadsheets
- HTML pages
- Images with OCR support
- Research papers
- SOPs
- Contracts
- Reports
- GitHub documentation
- Internal manuals

## Canonical output artifacts

Each ingestion run should produce:

1. `source_metadata.json`
2. `document.md`
3. `chunks.jsonl`
4. `knowledge_graph.json`
5. `embedding_manifest.json`
6. `audit_log.json`

## Metadata model

Recommended fields:

```json
{
  "document_id": "uuid",
  "source_filename": "example.pdf",
  "source_type": "pdf",
  "content_hash": "sha256",
  "tenant_id": "workspace-id",
  "uploaded_by": "user-id",
  "created_at": "iso-date",
  "parser_chain": ["docling", "markitdown"],
  "classification": "internal",
  "agent_access": ["Hermes", "Atlas", "Sapphire"]
}
```

## Chunking strategy

Chunks should be semantic, not fixed-length only.

Recommended chunk policy:

- Preserve headings.
- Preserve table context.
- Keep citations and source page references.
- Keep related bullet groups together.
- Prefer 800 to 1,400 characters per chunk.
- Use 120 to 200 characters overlap when needed.
- Store parent section and source page metadata.

## Knowledge graph extraction

For each document, extract:

- Entities
- Concepts
- Processes
- Requirements
- Risks
- Dates
- People
- Organizations
- Systems
- Tools
- Cross-document references

Graph edges should include relationships such as:

- `requires`
- `supports`
- `depends_on`
- `mentions`
- `contradicts`
- `updates`
- `belongs_to`
- `evidence_for`

## Agent routing

Recommended routing:

- Hermes: orchestration and memory routing
- Atlas: retrieval and citation grounding
- Sapphire: research enrichment
- Guardian: compliance and approval policy
- TARS: planning and task breakdown
- Forge: deployment and technical workflow support

## Security considerations

- Never run document conversion with unnecessary privileges.
- Isolate temporary files.
- Enforce file-size limits.
- Validate MIME type and extension.
- Hash files before processing.
- Store parser logs for auditability.
- Treat OCR output as untrusted until validated.
- Do not expose service-role keys to the browser.

## Production roadmap

### Phase 1

- Add upload intake contract.
- Create parser abstraction.
- Generate Markdown output.
- Store metadata and audit logs.

### Phase 2

- Add Docling worker.
- Add MarkItDown worker.
- Add semantic chunker.
- Add embedding manifest.

### Phase 3

- Write chunks to Pinecone.
- Write metadata to Supabase.
- Add Hermes memory retrieval.
- Add DKOS source citations.

### Phase 4

- Add knowledge graph extraction.
- Add duplicate detection.
- Add document versioning.
- Add human approval for sensitive documents.
