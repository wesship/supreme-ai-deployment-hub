import { describe, expect, it } from 'vitest';

import { selectMusicProvider, type MusicProvider, type MusicRoutingConfig } from '../music/providerRouter';

const routing: MusicRoutingConfig = {
  default_provider: 'ace-step-1.5',
  premium_provider: 'ace-step-1.5-xl-turbo',
  lyrics_provider: 'heartmula-oss-3b',
  auto_routing_enabled: false,
};

const providers: MusicProvider[] = [
  {
    id: 'ace-step-1.5',
    enabled: false,
    tier: 'default',
    capabilities: ['text_to_music', 'lyrics', 'instrumental', 'cover', 'repaint'],
    routing_tags: ['default', 'fast', 'instrumental', 'edit'],
  },
  {
    id: 'ace-step-1.5-xl-turbo',
    enabled: false,
    tier: 'premium',
    capabilities: ['text_to_music', 'lyrics', 'instrumental'],
    routing_tags: ['premium', 'highest_quality', 'xl'],
  },
  {
    id: 'heartmula-oss-3b',
    enabled: false,
    tier: 'secondary',
    capabilities: ['text_to_music', 'lyrics', 'multilingual_lyrics', 'style_tags'],
    routing_tags: ['lyrics', 'multilingual', 'style_control', 'secondary'],
  },
];

describe('selectMusicProvider', () => {
  it('routes nothing while every provider is disabled', () => {
    expect(selectMusicProvider(providers, routing, { mode: 'default' })).toBeNull();
    expect(selectMusicProvider(providers, routing, { mode: 'premium' })).toBeNull();
    expect(selectMusicProvider(providers, routing, { mode: 'lyrics' })).toBeNull();
  });

  it('selects the configured provider only after it is enabled', () => {
    const enabled = providers.map((provider) =>
      provider.id === 'ace-step-1.5' ? { ...provider, enabled: true } : provider,
    );
    expect(selectMusicProvider(enabled, routing, { mode: 'default' })?.id).toBe('ace-step-1.5');
  });

  it('rejects a provider that cannot satisfy required capabilities', () => {
    const enabled = providers.map((provider) => ({ ...provider, enabled: true }));
    expect(
      selectMusicProvider(enabled, routing, {
        mode: 'premium',
        requiredCapabilities: ['multilingual_lyrics'],
      }),
    ).toBeNull();
  });

  it('keeps auto routing disabled until explicitly configured', () => {
    const enabled = providers.map((provider) => ({ ...provider, enabled: true }));
    expect(selectMusicProvider(enabled, routing, { mode: 'auto' })?.id).toBe('ace-step-1.5');
  });
});
