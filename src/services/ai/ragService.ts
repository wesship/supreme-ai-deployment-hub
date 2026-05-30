/**
 * Devonn.ai RAG Service
 * Handles document ingestion (chunking → embedding → Pinecone upsert)
 * and retrieval-augmented generation (query → nearest-neighbor search → context injection).
 *
 * Security architecture:
 *   ALL embedding and Pinecone calls are proxied through api.devonn.ai.
 *   OPENAI_API_KEY and PINECONE_API_KEY are server-side secrets only.
 *
 *   Frontend → api.devonn.ai/api/rag/ingest   → OpenAI embeddings + Pinecone upsert
 *   Frontend → api.devonn.ai/api/rag/retrieve  → OpenAI embed query + Pinecone query
 *   Frontend → api.devonn.ai/api/rag/delete    → Pinecone delete by filename
 */

// ─── Proxy base ────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.devonn.ai';

// Only non-secret index metadata is read from VITE_ vars
const PINECONE_HOST = import.meta.env.VITE_PINECONE_HOST as string;
const PINECONE_INDEX_NAME = import.meta.env.VITE_PINECONE_INDEX_NAME as string;

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

// ─── Chunking (client-side, no secrets needed) ────────────────────────────────

function chunkText(text: string, filename: string, userId?: string): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let start = 0;
  let index = 0;

  const estimatedTotal = Math.ceil(text.length / (CHUNK_SIZE - CHUNK_OVERLAP));

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunkContent = text.slice(start, end).trim();

    if (chunkContent.length > 50) {
      chunks.push({
        id: `${filename.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_${index}_${Date.now()}`,
        text: chunkContent,
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

  chunks.forEach(c => { c.metadata.totalChunks = chunks.length; });
  return chunks;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ingest a plain-text or pre-extracted document into Pinecone via server proxy.
 * The server handles OpenAI embedding and Pinecone upsert using server-side keys.
 */
export async function ingestDocument(
  text: string,
  filename: string,
  userId?: string
): Promise<IngestResult> {
  try {
    const chunks = chunkText(text, filename, userId);
    if (chunks.length === 0) {
      return { success: false, chunksIngested: 0, filename, error: 'Document too short to ingest' };
    }

    const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`${API_BASE}/api/rag/ingest`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ chunks, filename, userId }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`RAG ingest proxy error ${response.status}: ${err}`);
    }

    const result = await response.json();
    return {
      success: true,
      chunksIngested: result.chunksIngested ?? chunks.length,
      filename,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[RAG] Ingest error:', message);
    return { success: false, chunksIngested: 0, filename, error: message };
  }
}

/**
 * Retrieve relevant context chunks for a user query via server proxy.
 * Returns formatted context string ready for prompt injection.
 */
export async function retrieveContext(query: string): Promise<string> {
  try {
    const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`${API_BASE}/api/rag/retrieve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, topK: TOP_K, minScore: MIN_SCORE }),
    });

    if (!response.ok) return '';

    const data = await response.json();
    const results: RetrievedContext[] = data.results ?? [];

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
 * With proxy architecture, we check if the proxy host and index name are set.
 */
export function isRAGAvailable(): boolean {
  return !!(PINECONE_HOST && PINECONE_INDEX_NAME);
}

/**
 * Delete all vectors for a specific file from the index via server proxy.
 */
export async function deleteDocument(filename: string): Promise<void> {
  const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${API_BASE}/api/rag/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ filename }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(`RAG delete proxy error ${response.status}: ${err}`);
  }
}
