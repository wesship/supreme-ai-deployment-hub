import { describe, expect, it } from 'vitest';
import { parseAzuraCastNowPlaying } from './hnfRadio';

describe('parseAzuraCastNowPlaying', () => {
  it('normalizes the AzuraCast now-playing payload', () => {
    expect(
      parseAzuraCastNowPlaying({
        station: { name: 'HNF RADIO' },
        listeners: { current: 12 },
        live: { is_live: true },
        now_playing: {
          played_at: 1_789_000_000,
          song: {
            title: 'Signal One',
            artist: 'D3VONN',
            art: 'https://radio.d3vonn.io/art/track.jpg',
          },
        },
      }),
    ).toEqual({
      stationName: 'HNF RADIO',
      isLive: true,
      listeners: 12,
      track: {
        title: 'Signal One',
        artist: 'D3VONN',
        artworkUrl: 'https://radio.d3vonn.io/art/track.jpg',
      },
      playedAt: 1_789_000_000,
    });
  });

  it('fails safely on malformed input', () => {
    expect(parseAzuraCastNowPlaying(null)).toBeNull();
    expect(parseAzuraCastNowPlaying('bad payload')).toBeNull();
  });

  it('keeps missing metadata non-fatal', () => {
    expect(parseAzuraCastNowPlaying({})).toEqual({
      stationName: 'HNF RADIO',
      isLive: false,
      listeners: 0,
      track: null,
      playedAt: null,
    });
  });
});
