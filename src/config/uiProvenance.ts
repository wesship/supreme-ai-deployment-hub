/**
 * Public provenance for the canonical D3VONN.IO interface.
 *
 * Keep this file limited to non-sensitive identifiers that are safe to ship
 * in a browser bundle. External design-tool project identifiers are not part
 * of the production provenance contract.
 */
export const UI_PROVENANCE = {
  source: 'd3vonn-native',
  canonicalHost: 'https://www.d3vonn.io',
  product: 'D3VONN.IO',
  interface: 'AI Business Operating System',
} as const;

export type UiProvenance = typeof UI_PROVENANCE;
