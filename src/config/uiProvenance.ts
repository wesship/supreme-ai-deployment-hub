/**
 * Public provenance for the currently adopted D3VONN.IO UI source.
 *
 * Keep this file limited to non-sensitive identifiers that are safe to ship
 * in a browser bundle. Readdy user IDs, session IDs, and request IDs are
 * intentionally excluded.
 */
export const UI_PROVENANCE = {
  source: 'readdy',
  projectId: 'dd3b402e-1da4-4fe4-954a-fad4fe9e7515',
  projectVersionId: 14281026,
  showId: 1,
  projectUrl: 'https://readdy.ai/project/dd3b402e-1da4-4fe4-954a-fad4fe9e7515',
} as const;

export type UiProvenance = typeof UI_PROVENANCE;
