import { describe, expect, it } from 'vitest';
import { HNF_TV_CHANNELS, getHnfTvChannel } from './hnfTv';

describe('HNF_TV_CHANNELS', () => {
  it('registers all five production channel routes', () => {
    expect(HNF_TV_CHANNELS.map((channel) => channel.slug)).toEqual([
      'peewee',
      'academy',
      'hnftv',
      'hiphop',
      'chef',
    ]);
  });

  it('publishes HTTPS HLS URLs from the HNF stream host', () => {
    for (const channel of HNF_TV_CHANNELS) {
      expect(channel.streamUrl).toBe(
        `https://stream.hnfportal.one/${channel.slug}/index.m3u8`,
      );
    }
  });

  it('includes the cooking channel as HNF Chef TV', () => {
    expect(getHnfTvChannel('chef')).toMatchObject({
      name: 'HNF Chef TV',
      category: 'Cooking',
      streamUrl: 'https://stream.hnfportal.one/chef/index.m3u8',
    });
  });
});
