import React from 'react';

export type VideoMaturity = 'Concept' | 'Simulation' | 'Beta' | 'Live Product';

export interface ProductVideoSpec {
  /** Stable id used for analytics events */
  id: string;
  title: string;
  description: string;
  /** MP4 source (required for the video to render) */
  mp4: string | null;
  /** Optional WebM source, preferred by capable browsers */
  webm?: string | null;
  /** Poster image shown before playback */
  poster?: string;
  /** WebVTT captions track */
  captions?: string;
  /** Full transcript text shown beneath instructional videos */
  transcript?: string;
  /** Short decorative loop (muted autoplay) vs instructional (controls, no autoplay) */
  kind: 'loop' | 'instructional';
  maturity: VideoMaturity;
}

const maturityStyles: Record<VideoMaturity, string> = {
  Concept: 'border-amber-400/40 bg-amber-950/40 text-amber-300',
  Simulation: 'border-purple-400/40 bg-purple-950/40 text-purple-300',
  Beta: 'border-blue-400/40 bg-blue-950/40 text-blue-300',
  'Live Product': 'border-emerald-400/40 bg-emerald-950/40 text-emerald-300',
};

const track = (id: string, event: string) => {
  try {
    window.dispatchEvent(new CustomEvent('d3vonn:video', { detail: { id, event } }));
  } catch {
    /* analytics is best-effort */
  }
};

/**
 * Renders a product video per the D3VONN video implementation standard:
 * 16:9, lazy loading, reduced-motion support, WebM+MP4, captions, maturity
 * label, and play/quartile/complete analytics events. Returns null when no
 * source is configured so unfinished videos never appear publicly.
 */
const ProductVideo: React.FC<{ spec: ProductVideoSpec; className?: string }> = ({ spec, className }) => {
  const quartiles = React.useRef<Set<number>>(new Set());
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (!spec.mp4 && !spec.webm) return null;

  const isLoop = spec.kind === 'loop';
  const autoPlay = isLoop && !prefersReducedMotion;

  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
        <span
          className={`absolute left-3 top-3 z-10 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${maturityStyles[spec.maturity]}`}
        >
          {spec.maturity}
        </span>
        <video
          className="aspect-video w-full"
          poster={spec.poster}
          controls={!isLoop || prefersReducedMotion}
          muted={isLoop}
          loop={isLoop}
          autoPlay={autoPlay}
          playsInline
          preload="none"
          onPlay={() => track(spec.id, 'play')}
          onEnded={() => track(spec.id, 'complete')}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (!v.duration) return;
            const pct = Math.floor((v.currentTime / v.duration) * 100);
            for (const q of [25, 50, 75]) {
              if (pct >= q && !quartiles.current.has(q)) {
                quartiles.current.add(q);
                track(spec.id, `${q}%`);
              }
            }
          }}
        >
          {spec.webm && <source src={spec.webm} type="video/webm" />}
          {spec.mp4 && <source src={spec.mp4} type="video/mp4" />}
          {spec.captions && <track kind="captions" src={spec.captions} srcLang="en" label="English" default />}
        </video>
      </div>
      <figcaption className="mt-3">
        <p className="text-sm font-bold text-white">{spec.title}</p>
        <p className="mt-1 text-sm text-white/60">{spec.description}</p>
        {spec.transcript && (
          <details className="mt-2 text-sm text-white/60">
            <summary className="cursor-pointer font-semibold text-blue-300">Transcript</summary>
            <p className="mt-2 whitespace-pre-line">{spec.transcript}</p>
          </details>
        )}
      </figcaption>
    </figure>
  );
};

export default ProductVideo;
