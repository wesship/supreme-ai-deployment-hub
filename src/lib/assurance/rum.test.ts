import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordVital } from './rum';

afterEach(() => vi.unstubAllGlobals());

describe('RUM environment boundary', () => {
  function setHost(hostname: string) {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('window', { location: { hostname, pathname: '/' } });
    vi.stubGlobal('navigator', { sendBeacon });
    vi.stubGlobal('performance', { getEntriesByType: vi.fn(() => []) });
    return sendBeacon;
  }

  it.each(['localhost', '127.0.0.1', '::1', '[::1]'])('does not send local preview vitals from %s to production', (host) => {
    const beacon = setHost(host);
    recordVital('LCP', 1200);
    expect(beacon).not.toHaveBeenCalled();
  });

  it.each(['www.d3vonn.io', 'd3vonn.io', 'preview.vercel.app'])('retains hosted telemetry collection for %s', (host) => {
    const beacon = setHost(host);
    recordVital('LCP', 1200);
    expect(beacon).toHaveBeenCalledWith('https://api.d3vonn.io/api/assurance/public/rum', expect.any(Blob));
  });
});
