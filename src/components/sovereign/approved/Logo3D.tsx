import { useRef, useState } from 'react';

const LOGO =
  '/approved-home/emblem.webp';

const DEPTH_LAYERS = [-6, -12, -18, -24, -30];

// Intersecting edge masks so the emblem dissolves into the surrounding
// background instead of showing a hard rectangular edge. The centre stays
// fully opaque so the D3VONN.IO wordmark remains crisp and readable.
const EDGE_MASK =
  'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent), linear-gradient(180deg, transparent, #000 10%, #000 90%, transparent)';

export default function Logo3D() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -12, y: px * 16 });
  };

  const reset = () => {
    setActive(false);
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div className="w-full">
      <div
        className="[perspective:1600px]"
        onMouseMove={onMove}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={reset}
      >
        <div className="logo-float">
          <div
            ref={frame}
            className="relative aspect-[16/7] w-full"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${8 + tilt.x}deg) rotateY(${-10 + tilt.y}deg)`,
              transition: active
                ? 'transform 0.08s linear'
                : 'transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* ambient glow behind the emblem — blends the asset into the field */}
            <span className="absolute -inset-16 -z-10 rounded-full bg-primary-500/15 blur-[90px]"></span>

            {/* thickness layers — masked so their edges feather into the background */}
            {DEPTH_LAYERS.map((z) => (
              <img
                key={z}
                src={LOGO}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover object-center opacity-80"
                style={{
                  transform: `translateZ(${z}px)`,
                  filter: `brightness(${0.55 + Math.abs(z) / 80})`,
                  maskImage: EDGE_MASK,
                  maskComposite: 'intersect',
                  WebkitMaskComposite: 'source-in',
                  WebkitMaskImage: EDGE_MASK,
                }}
              />
            ))}

            {/* front face */}
            <div className="relative h-full w-full" style={{ transform: 'translateZ(0px)' }}>
              <img
                src={LOGO}
                alt="D3VONN"
                fetchPriority="high"
                loading="eager"
                className="h-full w-full object-cover object-center"
                style={{ maskImage: EDGE_MASK,
                  maskComposite: 'intersect',
                  WebkitMaskComposite: 'source-in', WebkitMaskImage: EDGE_MASK }}
              />
              {/* glass sheen that tracks the tilt */}
              <span
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(circle at ${50 + tilt.y * 3}% ${50 + tilt.x * 3}%, rgba(255,255,255,0.30) 0%, rgba(125,241,255,0.09) 28%, transparent 60%)`,
                  maskImage: EDGE_MASK,
                  maskComposite: 'intersect',
                  WebkitMaskComposite: 'source-in',
                  WebkitMaskImage: EDGE_MASK,
                }}
              ></span>
              {/* soft top light — radial, so it never draws a hard edge */}
              <span
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse 72% 62% at 50% 0%, rgba(255,255,255,0.16), transparent 72%)',
                  maskImage: EDGE_MASK,
                  maskComposite: 'intersect',
                  WebkitMaskComposite: 'source-in',
                  WebkitMaskImage: EDGE_MASK,
                }}
              ></span>
              {/* harmonizing core glow instead of a hard rim line */}
              <span
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse 58% 54% at 50% 52%, rgba(59,155,255,0.12), transparent 72%)',
                  maskImage: EDGE_MASK,
                  maskComposite: 'intersect',
                  WebkitMaskComposite: 'source-in',
                  WebkitMaskImage: EDGE_MASK,
                }}
              ></span>
            </div>
          </div>
        </div>
      </div>

      {/* water puddle reflection — feathered so it melts into the field */}
      <div className="relative mt-2 h-12 w-full md:h-16">
        <div className="water-reflect absolute inset-x-0 top-0 mx-auto h-full w-[86%]">
          <img
            src={LOGO}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-top"
            style={{
              transform: 'scaleY(-1)',
              maskImage:
                'radial-gradient(ellipse 62% 100% at 50% 100%, rgba(0,0,0,0.6), transparent 72%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 62% 100% at 50% 100%, rgba(0,0,0,0.6), transparent 72%)',
            }}
          />
        </div>
        <div className="water-puddle absolute bottom-0 left-1/2 h-10 w-[92%] -translate-x-1/2 md:h-14">
          <span className="water-ripple"></span>
          <span className="water-ripple" style={{ animationDelay: '1.1s' }}></span>
          <span className="water-ripple" style={{ animationDelay: '2.2s' }}></span>
        </div>
      </div>
    </div>
  );
}