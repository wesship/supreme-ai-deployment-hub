export type FilmCapability =
  | 'text-to-image'
  | 'image-to-video'
  | 'text-to-video'
  | 'video-to-video'
  | 'video-extension'
  | 'voice-generation'
  | 'sound-effects'
  | 'music';

export type FilmProviderId =
  | 'mock'
  | 'grok'
  | 'higgsfield'
  | 'runway'
  | 'luma'
  | 'kling'
  | 'invideo'
  | 'movieflow'
  | 'elevenlabs';

export interface FilmGenerationRequest {
  projectId: string;
  shotId?: string;
  capability: FilmCapability;
  prompt: string;
  negativePrompt?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  referenceAssets?: Array<{ type: string; signedUrl: string }>;
  canonSnapshot: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface FilmJob {
  id: string;
  provider: FilmProviderId;
  externalJobId?: string;
  status: 'queued' | 'submitted' | 'running' | 'completed' | 'failed' | 'cancelled';
  outputUrl?: string;
  error?: { code: string; message: string };
  costMetadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface FilmProvider {
  id: FilmProviderId;
  capabilities: FilmCapability[];
  isConfigured(): boolean;
  submit(request: FilmGenerationRequest): Promise<FilmJob>;
  getStatus(jobId: string): Promise<FilmJob>;
  cancel?(jobId: string): Promise<void>;
}

export interface ProviderRouteRequest {
  capability: FilmCapability;
  preferredProvider?: FilmProviderId;
  fallbackProviders?: FilmProviderId[];
  parallel?: boolean;
  maxProviders?: number;
}

export const PROVIDER_CAPABILITIES: Record<FilmProviderId, FilmCapability[]> = {
  mock: ['text-to-image', 'image-to-video', 'text-to-video', 'voice-generation', 'sound-effects'],
  grok: ['text-to-image', 'image-to-video', 'text-to-video', 'video-to-video', 'video-extension'],
  higgsfield: ['image-to-video', 'text-to-video'],
  runway: ['image-to-video', 'text-to-video', 'video-to-video'],
  luma: ['image-to-video', 'text-to-video', 'video-extension'],
  kling: ['text-to-image', 'image-to-video', 'text-to-video', 'video-to-video', 'video-extension'],
  invideo: ['text-to-video', 'image-to-video'],
  movieflow: ['text-to-video', 'image-to-video', 'video-extension'],
  elevenlabs: ['voice-generation', 'sound-effects', 'music'],
};

export function routeFilmProviders(request: ProviderRouteRequest, configured: FilmProviderId[]): FilmProviderId[] {
  const eligible = configured.filter((provider) => PROVIDER_CAPABILITIES[provider].includes(request.capability));
  const ordered = [request.preferredProvider, ...(request.fallbackProviders ?? []), ...eligible]
    .filter((provider): provider is FilmProviderId => Boolean(provider))
    .filter((provider, index, all) => all.indexOf(provider) === index)
    .filter((provider) => eligible.includes(provider));

  if (ordered.length === 0 && configured.includes('mock')) return ['mock'];
  if (!request.parallel) return ordered.slice(0, 1);
  return ordered.slice(0, request.maxProviders ?? 4);
}

export function redactProviderPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactProviderPayload);
  if (!value || typeof value !== 'object') return value;

  const sensitive = /api[_-]?key|authorization|token|secret|password|signed[_-]?url|output[_-]?url/i;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitive.test(key) ? '[REDACTED]' : redactProviderPayload(item),
    ]),
  );
}
