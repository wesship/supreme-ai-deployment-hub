/** Decorative motion should never require a slow software WebGL renderer. */
export const GRAPH_CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance',
  failIfMajorPerformanceCaveat: true,
};

export function supportsGraphWebGL(): boolean {
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    const canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2', GRAPH_CONTEXT_ATTRIBUTES)
      || canvas.getContext('webgl', GRAPH_CONTEXT_ATTRIBUTES);
    return gl !== null;
  } catch {
    return false;
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
