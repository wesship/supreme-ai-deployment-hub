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
    if (!gl) return false;
    // Some browsers allow CPU-backed contexts even with the caveat flag.
    // Use this only for the local rendering decision; never log GPU details.
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    return !/swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render driver/i.test(renderer);
  } catch {
    return false;
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
