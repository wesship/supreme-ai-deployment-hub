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

  it('routes Kling and InVideo for image-driven scene generation', () => {
    expect(routeFilmProviders(
      { capability: 'image-to-video', preferredProvider: 'kling', fallbackProviders: ['invideo'] },
      ['kling', 'invideo', 'mock'],
    )).toEqual(['kling']);
  });

  it('can parallelize Kling, InVideo, and MovieFlow scene renders', () => {
    expect(routeFilmProviders(
      { capability: 'text-to-video', parallel: true },
      ['kling', 'invideo', 'movieflow'],
    )).toEqual(['kling', 'invideo', 'movieflow']);
  });
});

describe('redactProviderPayload', () => {
  it('redacts nested credentials', () => {
    expect(redactProviderPayload({ authorization: 'Bearer secret', nested: { apiKey: 'secret', prompt: 'safe' } }))
      .toEqual({ authorization: '[REDACTED]', nested: { apiKey: '[REDACTED]', prompt: 'safe' } });
  });

  it('redacts temporary signed and output URLs while preserving ordinary URLs', () => {
    expect(redactProviderPayload({
      referenceAssets: [{ type: 'character', signedUrl: 'https://assets.example/private?token=abc' }],
      outputUrl: 'https://assets.example/output?signature=secret',
      signed_url: 'https://assets.example/private-snake?token=abc',
      output_url: 'https://assets.example/output-snake?signature=secret',
      publicUrl: 'https://example.com/public-reference',
    })).toEqual({
      referenceAssets: [{ type: 'character', signedUrl: '[REDACTED]' }],
      outputUrl: '[REDACTED]',
      signed_url: '[REDACTED]',
      output_url: '[REDACTED]',
      publicUrl: 'https://example.com/public-reference',
    });
  });
});
