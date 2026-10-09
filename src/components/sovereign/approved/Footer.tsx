import { useState, type FormEvent } from 'react';
import Logo from './Logo';
import { useNavigate } from 'react-router-dom';
import ReduceMotionToggle from './ReduceMotionToggle';


const nav = [
  { label: 'Platform', href: '#platform' },
  { label: 'Command Core', href: '/command-center', isRoute: true },
  { label: 'AI Agents', href: '/agents', isRoute: true },
  { label: 'AI Films', href: '/ai-films', isRoute: true },
  { label: 'Infrastructure', href: '#infrastructure' },
  { label: 'About', href: '#about' },
  { label: 'Marketplace', href: '/marketplace', isRoute: true },
  { label: 'Pricing', href: '/pricing', isRoute: true },
];

const legal = [
  { label: 'Blog', href: '/resources', isRoute: true },
  { label: 'Privacy', href: '/privacy', isRoute: true },
  { label: 'Terms', href: '/terms', isRoute: true },
  { label: 'Contact', href: '/contact', isRoute: true },
  { label: 'Admin OCC', href: '/occ', isRoute: true },
];

export default function Footer({ systemStatus }: { systemStatus: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate('/contact?inquiry=newsletter', { state: { email } });
  };

  return (
    <footer className="relative overflow-hidden border-t border-foreground-200/10 bg-background-100/50">
      <div className="seam absolute inset-x-0 top-0"></div>
      <div className="mx-auto max-w-[1680px] px-5 py-16 md:px-8">
        {/* newsletter */}
        <div className="glass mb-14 grid gap-8 rounded-lg p-8 lg:grid-cols-2 lg:items-center md:p-10">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent-400/70">
              The Signal
            </p>
            <h3 className="mt-3 font-heading text-2xl font-bold text-foreground-900">
              Dispatches from the cutting edge.
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-foreground-200 font-medium">
              Notes on sovereign AI, generative filmmaking, and the engineering behind the command
              layer. No noise — one signal, occasionally.
            </p>
          </div>
          <form
            id="newsletter-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="h-12 flex-1 rounded-md border border-foreground-200/20 bg-background-100 px-4 text-sm text-foreground-900 placeholder:text-foreground-300 focus:border-primary-500/60 focus:outline-none transition-colors"
            />
            <input
              type="text"
              name="website_alt"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              readOnly
              className="contact-aux"
            />
            <button
              type="submit"
              className="btn-primary inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer whitespace-nowrap transition-opacity"
            >
              Subscribe
              <i className="ri-arrow-right-line" />
            </button>
          </form>

        </div>

        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr]">
          {/* brand */}
          <div>
            <Logo />
            <p className="mt-6 max-w-sm text-sm leading-7 text-foreground-200 font-medium">
              A sovereign AI operating system unifying agents, filmmaking, voice, automation, and
              infrastructure under one command.
            </p>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.22em] text-primary-500/70">
              Signal over noise. Command over chaos.
            </p>
          </div>

          {/* navigation */}
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-foreground-200">
              Platform
            </h3>
            <ul className="mt-6 space-y-3">
              {nav.map((l) => (
                <li key={l.label}>
                  {l.isRoute ? (
                    <a
                      href={l.href}
                      className="text-sm text-foreground-200 font-medium transition-colors hover:text-foreground-900 cursor-pointer"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <a
                      href={l.href}
                      className="text-sm text-foreground-200 font-medium transition-colors hover:text-foreground-900 cursor-pointer"
                    >
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* legal */}
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-foreground-200">
              Company
            </h3>
            <ul className="mt-6 space-y-3">
              {legal.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm text-foreground-200 font-medium transition-colors hover:text-foreground-900 cursor-pointer"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>

            {/* system status */}
            <div className="mt-8 rounded-md border border-foreground-200/10 bg-background-50 p-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute h-2 w-2 animate-ping rounded-full bg-accent-500/60"></span>
                  <span className="relative h-2 w-2 rounded-full bg-accent-500"></span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-200">
                  {systemStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-foreground-200/10 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground-300/80">© 2026 D3VONN.IO. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-5">
            <ReduceMotionToggle />
            <a
              href="#top"
              className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-300/80 transition-colors hover:text-foreground-900 cursor-pointer"
            >
              Back to top
              <i className="ri-arrow-up-line"></i>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}