import { describe, expect, it } from 'vitest';
import { isTrackAudible } from '../music/MusicStemTimeline';

describe('Music Stem Timeline routing', () => {
  it('plays unmuted tracks when none are soloed', () => {
    expect(isTrackAudible({ muted: false, solo: false }, false)).toBe(true);
    expect(isTrackAudible({ muted: true, solo: false }, false)).toBe(false);
  });
  it('silences non-solo tracks when any track is soloed', () => {
    expect(isTrackAudible({ muted: false, solo: false }, true)).toBe(false);
    expect(isTrackAudible({ muted: false, solo: true }, true)).toBe(true);
    expect(isTrackAudible({ muted: true, solo: true }, true)).toBe(false);
  });
});
