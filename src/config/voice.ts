export const D3VONN_PRODUCTION_VAPI_ASSISTANT_ID =
  '8491eea7-e385-426b-8cdc-3e2aaf9a4cbf';

/**
 * This is Vapi's publishable browser key, intentionally safe to ship in the
 * client bundle. Vercel can override it without requiring a code change.
 */
export const D3VONN_PRODUCTION_VAPI_PUBLIC_KEY =
  'f436d2be-5679-4838-80e0-9b2466f25bb2';

/**
 * Vapi assistant identifiers are browser-safe public configuration.
 * Vercel can override this default without requiring a code change.
 */
export const getVapiAssistantId = (): string =>
  import.meta.env.VITE_VAPI_ASSISTANT_ID?.trim() || D3VONN_PRODUCTION_VAPI_ASSISTANT_ID;

/**
 * Vapi public keys are browser-safe configuration. The environment variable
 * remains the preferred deployment-time override, while the production default
 * keeps the published voice surface usable when the Vercel setting is absent.
 */
export const getVapiPublicKey = (): string =>
  import.meta.env.VITE_VAPI_PUBLIC_KEY?.trim() || D3VONN_PRODUCTION_VAPI_PUBLIC_KEY;
