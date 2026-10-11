import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRAPH_CONTEXT_ATTRIBUTES, supportsGraphWebGL } from './graphWebGL';

afterEach(() => vi.restoreAllMocks());

describe('Decorative graph capability', () => {
  it('requires a context without major performance caveats and releases the probe', () => {
    const loseContext = vi.fn();
    const context = { getExtension: vi.fn(() => ({ loseContext })) };
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
    expect(supportsGraphWebGL()).toBe(true);
    expect(getContext).toHaveBeenCalledWith('webgl2', GRAPH_CONTEXT_ATTRIBUTES);
    expect(GRAPH_CONTEXT_ATTRIBUTES.failIfMajorPerformanceCaveat).toBe(true);
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it('retains the WebGL1 path when WebGL2 is unavailable', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValueOnce(null).mockReturnValueOnce({ getExtension: () => null } as never);
    expect(supportsGraphWebGL()).toBe(true);
    expect(getContext).toHaveBeenLastCalledWith('webgl', GRAPH_CONTEXT_ATTRIBUTES);
  });

  it('keeps the existing static atmosphere when the browser rejects costly contexts', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(supportsGraphWebGL()).toBe(false);
  });

  it('falls back when WebGL initialization throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => { throw new Error('Unavailable'); });
    expect(supportsGraphWebGL()).toBe(false);
  });
});
