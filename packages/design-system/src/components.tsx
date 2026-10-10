import React from 'react';

const join = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

export type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: 'glass' | 'carbon' | 'chrome';
};

export function Surface({ tone = 'glass', className, ...props }: SurfaceProps) {
  const tones = {
    glass: 'border border-white/10 bg-white/[0.055] backdrop-blur-xl shadow-2xl',
    carbon: 'border border-slate-700/70 bg-slate-950/85 shadow-2xl',
    chrome: 'border border-blue-200/20 bg-gradient-to-br from-slate-800/85 via-slate-950/90 to-blue-950/65 shadow-[0_0_45px_rgba(30,144,255,0.16)]',
  };

  return <div className={join('rounded-[1.25rem]', tones[tone], className)} {...props} />;
}

export type SectionProps = React.HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function Section({ eyebrow, title, description, className, children, ...props }: SectionProps) {
  return (
    <section className={join('relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24', className)} {...props}>
      {(eyebrow || title || description) && (
        <header className="mb-10 max-w-3xl">
          {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{eyebrow}</p>}
          {title && <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h2>}
          {description && <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export type ActionProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: 'primary' | 'secondary' | 'quiet';
};

export function Action({ variant = 'primary', className, ...props }: ActionProps) {
  const variants = {
    primary: 'border-blue-300/40 bg-blue-500 text-white shadow-[0_0_30px_rgba(30,144,255,0.3)] hover:bg-blue-400',
    secondary: 'border-white/15 bg-white/[0.06] text-white hover:border-blue-300/35 hover:bg-blue-500/10',
    quiet: 'border-transparent bg-transparent text-blue-200 hover:bg-blue-500/10',
  };

  return (
    <a
      className={join(
        'inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export type PageShellProps = React.HTMLAttributes<HTMLDivElement>;

export function PageShell({ className, children, ...props }: PageShellProps) {
  return (
    <div className={join('min-h-screen overflow-x-hidden bg-[#05070B] text-white', className)} {...props}>
      <a href="#main-content" className="sr-only z-[100] rounded-md bg-white px-4 py-2 text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      {children}
    </div>
  );
}
