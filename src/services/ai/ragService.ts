/**
 * Devonn.ai RAG Service
 * Handles document ingestion (chunking → embedding → Pinecone upsert)
 * and retrieval-augmented generation (query → nearest-neighbor search → context injection).
 *
 * Pinecone index: document-store (cosine, 768 dimensions)
 * Embedding model: text-embedding-3-small (1536d) → projected to 768d via truncation
 * Note: We use text-embedding-3-small with dimensions=768 to match the existing index.
 */

const PINECONE_API_KEY = import.meta.env.VITE_PINECONE_API_KEY as string;
const PINECONE_HOST = import.meta.env.VITE_PINECONE_HOST as string;
const PINECONE_INDEX_NAME = import.meta.env.VITE_PINECONE_INDEX_NAME as string;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string;

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 768;
const CHUNK_SIZE = 800;       // characters per chunk
const CHUNK_OVERLAP = 100;    // character overlap between chunks
const TOP_K = 5;              // number of context chunks to retrieve
const MIN_SCORE = 0.70;       // minimum cosine similarity to include

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    source: string;
    filename: string;
    chunkIndex: number;
    totalChunks: number;
    userId?: string;
    uploadedAt: string;
  };
}

export interface RetrievedContext {
  text: string;
  source: string;
  score: number;
}

export interface IngestResult {
  success: boolean;
  chunksIngested: number;
  filename: string;
  error?: string;
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text: string, filename: string, userId?: string): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let start = 0;
  let index = 0;

  // Estimate total chunks
  const estimatedTotal = Math.ceil(text.length / (CHUNK_SIZE - CHUNK_OVERLAP));

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunkText = text.slice(start, end).trim();

    if (chunkText.length > 50) { // skip tiny trailing chunks
      chunks.push({
        id: `${filename.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_${index}_${Date.now()}`,
        text: chunkText,
        metadata: {
          source: filename,
          filename,
          chunkIndex: index,
          totalChunks: estimatedTotal,
          userId,
          uploadedAt: new Date().toISOString(),
        },
      });
      index++;
    }

    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  // Update totalChunks now that we know the real count
  chunks.forEach(c => { c.metadata.totalChunks = chunks.length; });

  return chunks;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI embedding error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

// ─── Pinecone Upsert ──────────────────────────────────────────────────────────

async function upsertToPinecone(
  chunks: DocumentChunk[],
  embeddings: number[][]
): Promise<void> {
  const vectors = chunks.map((chunk, i) => ({
    id: chunk.id,
    values: embeddings[i],
    metadata: {
      text: chunk.text,
      ...chunk.metadata,
    },
  }));

  // Batch in groups of 100 (Pinecone limit)
  const BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    const response = await fetch(`https://${PINECONE_HOST}/vectors/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': PINECONE_API_KEY,
      },
      body: JSON.stringify({ vectors: batch, namespace: 'documents' }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Pinecone upsert error ${response.status}: ${err}`);
    }
  }
}

// ─── Pinecone Query ───────────────────────────────────────────────────────────

async function queryPinecone(queryEmbedding: number[]): Promise<RetrievedContext[]> {
  const response = await fetch(`https://${PINECONE_HOST}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': PINECONE_API_KEY,
    },
    body: JSON.stringify({
      vector: queryEmbedding,
      topK: TOP_K,
      includeMetadata: true,
      namespace: 'documents',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Pinecone query error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const matches = data.matches ?? [];

  return matches
    .filter((m: { score: number }) => m.score >= MIN_SCORE)
    .map((m: { score: number; metadata: { text: string; source: string } }) => ({
      text: m.metadata?.text ?? '',
      source: m.metadata?.source ?? 'unknown',
      score: m.score,
    }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ingest a plain-text or pre-extracted document into Pinecone.
 * Call this after reading a file's text content.
 */
export async function ingestDocument(
  text: string,
  filename: string,
  userId?: string
): Promise<IngestResult> {
  try {
    if (!PINECONE_API_KEY || !OPENAI_API_KEY) {
      throw new Error('Missing VITE_PINECONE_API_KEY or VITE_OPENAI_API_KEY');
    }

    const chunks = chunkText(text, filename, userId);
    if (chunks.length === 0) {
      return { success: false, chunksIngested: 0, filename, error: 'Document too short to ingest' };
    }

    // Embed in batches of 20 to avoid rate limits
    const EMBED_BATCH = 20;
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH);
      const embeddings = await embedTexts(batch.map(c => c.text));
      allEmbeddings.push(...embeddings);
    }

    await upsertToPinecone(chunks, allEmbeddings);

    return { success: true, chunksIngested: chunks.length, filename };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[RAG] Ingest error:', message);
    return { success: false, chunksIngested: 0, filename, error: message };
  }
}

/**
 * Retrieve relevant context chunks for a user query.
 * Returns formatted context string ready for prompt injection.
 */
export async function retrieveContext(query: string): Promise<string> {
  try {
    if (!PINECONE_API_KEY || !OPENAI_API_KEY) return '';

    const [queryEmbedding] = await embedTexts([query]);
    const results = await queryPinecone(queryEmbedding);

    if (results.length === 0) return '';

    const contextBlocks = results.map((r, i) =>
      `[Source ${i + 1}: ${r.source} (score: ${r.score.toFixed(2)})]\n${r.text}`
    );

    return contextBlocks.join('\n\n---\n\n');
  } catch (err) {
    console.error('[RAG] Retrieval error:', err);
    return ''; // Fail silently — don't break the chat
  }
}

/**
 * Check if the RAG layer is configured and available.
 */
export function isRAGAvailable(): boolean {
  return !!(PINECONE_API_KEY && PINECONE_HOST && OPENAI_API_KEY);
}

/**
 * Delete all vectors for a specific file from the index.
 */
export async function deleteDocument(filename: string): Promise<void> {
  // Pinecone serverless supports delete by metadata filter
  const response = await fetch(`https://${PINECONE_HOST}/vectors/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': PINECONE_API_KEY,
    },
    body: JSON.stringify({
      filter: { filename: { $eq: filename } },
      namespace: 'documents',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Pinecone delete error ${response.status}: ${err}`);
  }
}
