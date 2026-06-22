import ComingSoonPage from '@/components/ComingSoonPage';

const Music = () => (
  <ComingSoonPage
    title="Music Generator"
    description="Full AI song production — lyrics, vocals, instrumentation, and mastering — from a single prompt."
    roadmap={[
      'Prompt-to-song with style and BPM controls',
      'Lyric editor with vocal performance synthesis',
      'Stem separation and remixing tools',
      'One-click publishing to your library',
    ]}
  />
);

export default Music;
