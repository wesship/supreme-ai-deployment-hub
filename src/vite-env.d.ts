/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;

  // OpenAI
  readonly VITE_OPENAI_API_KEY: string;

  // Pinecone (RAG)
  readonly VITE_PINECONE_API_KEY: string;
  readonly VITE_PINECONE_HOST: string;
  readonly VITE_PINECONE_INDEX_NAME: string;
  readonly VITE_PINECONE_DIMENSION: string;

  // Backend
  readonly VITE_API_URL?: string;

  // Voice (Phase 4)
  readonly VITE_ELEVENLABS_API_KEY?: string;
  readonly VITE_ASSEMBLYAI_API_KEY?: string;

  // Tools (Phase 3)
  readonly VITE_GITHUB_TOKEN?: string;
  readonly VITE_N8N_BASE_URL?: string;
  readonly VITE_N8N_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
