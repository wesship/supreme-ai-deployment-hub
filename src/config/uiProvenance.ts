/**
 * Public provenance for the canonical D3VONN.IO UI source.
 *
 * The frontend is built directly from the D3VONN repository. External UI
 * builders are not runtime authorities for production.
 */
export const UI_PROVENANCE = {
  source: 'repository',
  repository: 'wesship/supreme-ai-deployment-hub',
  surface: 'neural-nexus',
  route: '/',
} as const;

export type UiProvenance = typeof UI_PROVENANCE;
