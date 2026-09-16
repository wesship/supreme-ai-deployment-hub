import { env } from '@/lib/env';

export interface HnfRadioTrack {
  title: string;
  artist: string;
  artworkUrl: string | null;
}

export interface HnfRadioNowPlaying {
  stationName: string;
  isLive: boolean;
  listeners: number;
  track: HnfRadioTrack | null;
  playedAt: number | null;
}

interface AzuraCastNowPlayingPayload {
  station?: { name?: unknown };
  listeners?: { current?: unknown };
  live?: { is_live?: unknown };
  now_playing?: {
    played_at?: unknown;
    song?: {
      title?: unknown;
      artist?: unknown;
      art?: unknown;
    };
  };
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isAllowedPublicUrl(value: string): boolean {
  if (!value) return false;

  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;

    return !env.isProduction &&
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

export function getHnfRadioConfig() {
  const streamUrl = env.hnfRadioStreamUrl;
  const nowPlayingUrl = env.hnfRadioNowPlayingUrl;

  const streamReady = isAllowedPublicUrl(streamUrl);
  const metadataReady = isAllowedPublicUrl(nowPlayingUrl);

  return {
    enabled: streamReady && metadataReady,
    streamReady,
    metadataReady,
    streamUrl: streamReady ? streamUrl : '',
    nowPlayingUrl: metadataReady ? nowPlayingUrl : '',
  } as const;
}

export function parseAzuraCastNowPlaying(payload: unknown): HnfRadioNowPlaying | null {
  if (!payload || typeof payload !== 'object') return null;

  const source = payload as AzuraCastNowPlayingPayload;
  const stationName = safeString(source.station?.name) || 'HNF RADIO';
  const listeners = safeNumber(source.listeners?.current) ?? 0;
  const isLive = source.live?.is_live === true;
  const playedAt = safeNumber(source.now_playing?.played_at);

  const title = safeString(source.now_playing?.song?.title);
  const artist = safeString(source.now_playing?.song?.artist);
  const artworkUrl = safeString(source.now_playing?.song?.art);

  const track = title || artist
    ? {
        title: title || 'Unknown title',
        artist: artist || 'Unknown artist',
        artworkUrl: artworkUrl || null,
      }
    : null;

  return {
    stationName,
    isLive,
    listeners: Math.max(0, Math.trunc(listeners)),
    track,
    playedAt,
  };
}

export async function fetchHnfNowPlaying(signal?: AbortSignal): Promise<HnfRadioNowPlaying | null> {
  const { nowPlayingUrl, metadataReady } = getHnfRadioConfig();
  if (!metadataReady) return null;

  const response = await fetch(nowPlayingUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`HNF Radio now-playing request failed with HTTP ${response.status}`);
  }

  return parseAzuraCastNowPlaying(await response.json());
}
