/// <reference types="vite/client" />

/**
 * Devonn.ai — Safe Frontend Environment Variables
 *
 * RULE: Only non-sensitive, public values use the VITE_ prefix.
 * Anything with VITE_ is bundled into the client JavaScript and visible to all users.
 *
 * ✅ SAFE IN FRONTEND (VITE_ prefix allowed):
 *   VITE_API_URL          — Public backend URL (no secret)
 *   VITE_SUPABASE_URL     — Public Supabase project URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY — Supabase anon key (public by design)
 *   VITE_N8N_BASE_URL     — Public n8n webhook base URL (no auth)
 *   VITE_PINECONE_HOST    — Public Pinecone index host
 *   VITE_PINECONE_INDEX_NAME — Index name (not a secret)
 *   VITE_PINECONE_DIMENSION  — Embedding dimension (not a secret)
 *
 * ❌ NEVER IN FRONTEND (server-side only, no VITE_ prefix):
 *   OPENAI_API_KEY        → api.devonn.ai/api/chat proxy
 *   ELEVENLABS_API_KEY    → api.devonn.ai/api/tools/voice/tts proxy
 *   ASSEMBLYAI_API_KEY    → api.devonn.ai/api/tools/voice/stt-token proxy
 *   GITHUB_TOKEN          → api.devonn.ai/api/tools/github/* proxy
 *   N8N_API_KEY           → api.devonn.ai/api/tools/n8n/execute proxy
 *   PINECONE_API_KEY      → api.devonn.ai or server-side RAG pipeline
 */

interface ImportMetaEnv {
  // ── Public backend URL ──────────────────────────────────────────────────────
  readonly VITE_API_URL?: string;

  // ── Supabase (public by design — anon key is safe in browser) ──────────────
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;

  // ── Pinecone (index metadata only — API key is server-side) ────────────────
  readonly VITE_PINECONE_HOST: string;
  readonly VITE_PINECONE_INDEX_NAME: string;
  readonly VITE_PINECONE_DIMENSION: string;

  // ── n8n base URL (public webhook endpoint — no auth in URL) ────────────────
  readonly VITE_N8N_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
