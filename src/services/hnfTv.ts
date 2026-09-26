export type HnfTvChannelSlug = 'peewee' | 'academy' | 'hnftv' | 'hiphop' | 'chef';

export interface HnfTvChannel {
  slug: HnfTvChannelSlug;
  name: string;
  category: string;
  streamUrl: string;
}

const HNF_TV_STREAM_ORIGIN = 'https://stream.hnfportal.one';

export const HNF_TV_CHANNELS: readonly HnfTvChannel[] = [
  {
    slug: 'peewee',
    name: 'Pee Wee & Friends',
    category: 'Kids & Family',
    streamUrl: `${HNF_TV_STREAM_ORIGIN}/peewee/index.m3u8`,
  },
  {
    slug: 'academy',
    name: 'HNF Academy',
    category: 'Education',
    streamUrl: `${HNF_TV_STREAM_ORIGIN}/academy/index.m3u8`,
  },
  {
    slug: 'hnftv',
    name: 'HNF.TV',
    category: 'General',
    streamUrl: `${HNF_TV_STREAM_ORIGIN}/hnftv/index.m3u8`,
  },
  {
    slug: 'hiphop',
    name: 'Hip Hop National Flag',
    category: 'Music & Culture',
    streamUrl: `${HNF_TV_STREAM_ORIGIN}/hiphop/index.m3u8`,
  },
  {
    slug: 'chef',
    name: 'HNF Chef TV',
    category: 'Cooking',
    streamUrl: `${HNF_TV_STREAM_ORIGIN}/chef/index.m3u8`,
  },
] as const;

export function getHnfTvChannel(slug: HnfTvChannelSlug): HnfTvChannel {
  const channel = HNF_TV_CHANNELS.find((item) => item.slug === slug);
  if (!channel) {
    throw new Error(`Unknown HNF.TV channel: ${slug}`);
  }
  return channel;
}
