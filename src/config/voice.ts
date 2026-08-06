export const D3VONN_PRODUCTION_VAPI_ASSISTANT_ID =
  '8491eea7-e385-426b-8cdc-3e2aaf9a4cbf';

/**
 * Vapi assistant identifiers are browser-safe public configuration.
 * Vercel can override this default without requiring a code change.
 */
export const getVapiAssistantId = (): string =>
  import.meta.env.VITE_VAPI_ASSISTANT_ID?.trim() || D3VONN_PRODUCTION_VAPI_ASSISTANT_ID;
