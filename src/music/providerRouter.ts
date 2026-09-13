export type MusicProvider = {
  id: string;
  enabled: boolean;
  capabilities: string[];
  routing_tags: string[];
  tier: 'default' | 'premium' | 'secondary';
};

export type MusicRoutingConfig = {
  default_provider: string;
  premium_provider: string;
  lyrics_provider: string;
  auto_routing_enabled: boolean;
};

export type MusicRouteRequest = {
  mode?: 'default' | 'premium' | 'lyrics' | 'auto';
  requiredCapabilities?: string[];
  routingTags?: string[];
};

export function selectMusicProvider(
  providers: MusicProvider[],
  routing: MusicRoutingConfig,
  request: MusicRouteRequest,
): MusicProvider | null {
  const enabled = providers.filter((provider) => provider.enabled === true);
  const satisfies = (provider: MusicProvider) =>
    (request.requiredCapabilities ?? []).every((capability) => provider.capabilities.includes(capability)) &&
    (request.routingTags ?? []).every((tag) => provider.routing_tags.includes(tag));

  const preferredId =
    request.mode === 'premium'
      ? routing.premium_provider
      : request.mode === 'lyrics'
        ? routing.lyrics_provider
        : routing.default_provider;

  if (request.mode !== 'auto' || routing.auto_routing_enabled !== true) {
    return enabled.find((provider) => provider.id === preferredId && satisfies(provider)) ?? null;
  }

  const candidates = enabled.filter(satisfies);
  return (
    candidates.find((provider) => provider.id === routing.default_provider) ??
    candidates.find((provider) => provider.tier === 'premium') ??
    candidates[0] ??
    null
  );
}
