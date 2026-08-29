(() => {
  if (/^\/film(?:\/|$)/.test(window.location.pathname)) {
    const tracked = new WeakSet();
    const mediaObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target;
        if (!(video instanceof HTMLVideoElement)) continue;
        if (!entry.isIntersecting) continue;
        if (video.dataset.d3DeferredAutoplay === 'true') void video.play().catch(() => undefined);
        mediaObserver.unobserve(video);
      }
    }, { rootMargin: '500px 0px' });

    const deferBelowFoldVideos = () => {
      document.querySelectorAll('video').forEach((video, index) => {
        if (tracked.has(video) || index === 0) return;
        tracked.add(video);
        if (video.getBoundingClientRect().top <= window.innerHeight + 500) return;
        video.dataset.d3DeferredAutoplay = video.autoplay ? 'true' : 'false';
        video.autoplay = false;
        video.preload = 'none';
        video.pause();
        mediaObserver.observe(video);
      });
    };

    let mediaScanFrame = 0;
    const scheduleVideoScan = () => {
      if (mediaScanFrame) return;
      mediaScanFrame = window.requestAnimationFrame(() => {
        mediaScanFrame = 0;
        deferBelowFoldVideos();
      });
    };

    const mediaMutationObserver = new MutationObserver(scheduleVideoScan);
    mediaMutationObserver.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('DOMContentLoaded', scheduleVideoScan, { once: true });
    window.addEventListener('load', scheduleVideoScan, { once: true });
  }

  const CORE_ALT = 'D3VONN.IO D3 Core';
  const CORE_SRC = '/core-01-helmet.svg?v=20260725-core-fix';
  const FALLBACK_SRC = '/d3vonn-main-logo.svg?v=20260724-official';

  const repairCoreArtwork = () => {
    const image = document.querySelector(`img[alt="${CORE_ALT}"]`);
    if (!(image instanceof HTMLImageElement)) return false;

    if (!image.dataset.coreArtworkRepaired) {
      image.dataset.coreArtworkRepaired = 'true';
      image.classList.add('d3-core-artwork-repaired');
      image.addEventListener('error', () => {
        if (!image.src.includes('d3vonn-main-logo.svg')) image.src = FALLBACK_SRC;
      });
    }

    if (!image.src.includes('core-01-helmet.svg') && !image.src.includes('d3vonn-main-logo.svg')) {
      image.src = CORE_SRC;
    }

    return true;
  };

  const observer = new MutationObserver(() => {
    if (repairCoreArtwork()) observer.disconnect();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', repairCoreArtwork, { once: true });
  window.setTimeout(() => {
    repairCoreArtwork();
    observer.disconnect();
  }, 10000);
})();
