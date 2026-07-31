import React from 'react';
import ProductVideo from '@/components/media/ProductVideo';
import { productVideos, configuredVideos } from '@/config/videos';

/**
 * "Watch the platform" — renders the master demo and product loops from the
 * central video registry. Renders nothing at all until at least one real
 * video asset is configured, so the homepage never shows placeholders.
 */
const PlatformVideosSection: React.FC = () => {
  const available = configuredVideos();
  if (available.length === 0) return null;

  const master = productVideos.masterDemo;
  const masterReady = Boolean(master.mp4 || master.webm);
  const loops = available.filter((v) => v.kind === 'loop');

  return (
    <section className="container mx-auto px-6 py-24" aria-labelledby="watch-platform-heading">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Watch the platform</p>
        <h2 id="watch-platform-heading" className="mt-4 text-3xl font-black sm:text-5xl">
          See a goal become <span className="text-blue-400">governed execution</span>.
        </h2>
      </div>

      {masterReady && <ProductVideo spec={master} className="mx-auto mt-12 max-w-4xl" />}

      {loops.length > 0 && (
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {loops.map((spec) => (
            <ProductVideo key={spec.id} spec={spec} />
          ))}
        </div>
      )}
    </section>
  );
};

export default PlatformVideosSection;
