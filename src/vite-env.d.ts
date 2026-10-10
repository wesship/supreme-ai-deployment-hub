/// <reference types="vite/client" />

/**
 * D3VONN.IO — Safe Frontend Environment Variables
 *
 * Only non-sensitive, publishable values may use the VITE_ prefix.
 * Provider private keys remain server-side.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ENVIRONMENT?: 'development' | 'staging' | 'production';
  readonly VITE_SENTRY_DSN?: string;

  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;

  readonly VITE_PINECONE_HOST: string;
  readonly VITE_PINECONE_INDEX_NAME: string;
  readonly VITE_PINECONE_DIMENSION: string;

  readonly VITE_N8N_BASE_URL?: string;

  // Public voice configuration only. Never expose provider private/API keys.
  readonly VITE_VOICE_PROVIDER?: 'elevenlabs' | 'vapi' | 'legacy';
  readonly VITE_ELEVENLABS_AGENT_ID?: string;
  readonly VITE_VAPI_PUBLIC_KEY?: string;
  readonly VITE_VAPI_ASSISTANT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
