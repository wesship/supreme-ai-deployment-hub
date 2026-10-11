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

  it.each(['/login', '/voice-studio', '/app', '/artist/private-slug', '/pricing/private'])('does not send unregistered or sensitive route %s', (pathname) => {
    const beacon = setHost('www.d3vonn.io');
    vi.stubGlobal('window', { location: { hostname: 'www.d3vonn.io', pathname } });
    recordVital('LCP', 1200);
    expect(beacon).not.toHaveBeenCalled();
  });

  it.each(['/pricing', '/security/disclosure', '/marketplace'])('sends approved public route %s', (pathname) => {
    const beacon = setHost('www.d3vonn.io');
    vi.stubGlobal('window', { location: { hostname: 'www.d3vonn.io', pathname } });
    recordVital('LCP', 1200);
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it.each(['www.d3vonn.io', 'd3vonn.io', 'preview.vercel.app'])('retains hosted telemetry collection for %s', (host) => {
    const beacon = setHost(host);
    recordVital('LCP', 1200);
    expect(beacon).toHaveBeenCalledWith('https://api.d3vonn.io/api/assurance/public/rum', expect.any(Blob));
  });
});
