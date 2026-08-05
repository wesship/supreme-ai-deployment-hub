import { describe, expect, it } from 'vitest';
import { redactProviderPayload, routeFilmProviders } from './providers';

describe('routeFilmProviders', () => {
  it('uses the preferred configured provider for a supported capability', () => {
    expect(routeFilmProviders({ capability: 'text-to-video', preferredProvider: 'grok' }, ['grok', 'mock']))
      .toEqual(['grok']);
  });

  it('falls back to mock when no real provider is configured', () => {
    expect(routeFilmProviders({ capability: 'voice-generation' }, ['mock'])).toEqual(['mock']);
  });

  it('returns multiple providers in parallel mode', () => {
    expect(routeFilmProviders({ capability: 'text-to-video', parallel: true }, ['grok', 'runway', 'luma']))
      .toEqual(['grok', 'runway', 'luma']);
  });
});

describe('redactProviderPayload', () => {
  it('redacts nested credentials', () => {
    expect(redactProviderPayload({ authorization: 'Bearer secret', nested: { apiKey: 'secret', prompt: 'safe' } }))
      .toEqual({ authorization: '[REDACTED]', nested: { apiKey: '[REDACTED]', prompt: 'safe' } });
  });
});
