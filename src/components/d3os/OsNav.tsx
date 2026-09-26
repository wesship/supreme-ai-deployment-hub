import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import SmartLaunchLink from '@/components/SmartLaunchLink';

const LINKS: Array<[string, string]> = [
  ['Agents', '/agents'],
  ['Automations', '/workflows'],
  ['Knowledge', '/dkos-ingestion'],
  ['Voice & Vision', '/voice-studio'],
  ['Marketplace', '/marketplace'],
  ['OCC', '/occ'],
];

/** Full-width operating-system top bar for the public homepage. */
const OsNav: React.FC = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-[60] w-full border-b border-[color:var(--os-line)] bg-[rgba(250,248,244,0.86)] backdrop-blur-xl">
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 md:px-6">
        <Link to="/" className="os-display flex cursor-pointer items-center gap-2 text-lg font-bold tracking-[-0.04em]">
          D3VONN
          <span style={{ color: 'var(--os-orange)' }}>.IO</span>
        </Link>

        <nav aria-label="Primary" className="hidden md:flex md:items-center md:gap-1">
          {LINKS.map(([label, to]) => (
            <Link
              key={to}
              to={to}
              className="cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-sm text-[color:var(--os-ink-60)] transition-colors hover:bg-[rgba(14,14,12,0.05)] hover:text-[color:var(--os-ink)]"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex md:items-center md:gap-2">
          <Link
            to="/login"
            className="cursor-pointer whitespace-nowrap rounded-md border border-[color:var(--os-line)] px-4 py-2 text-sm font-medium transition-colors hover:border-[color:var(--os-ink)]"
          >
            Log in
          </Link>
          <SmartLaunchLink
            authedTo="/app"
            className="cursor-pointer whitespace-nowrap rounded-md border border-[color:var(--os-ink)] bg-[color:var(--os-ink)] px-4 py-2 text-sm font-semibold text-[color:var(--os-pearl)] transition-colors hover:bg-[#25251f]"
          >
            Launch OS
          </SmartLaunchLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="os-mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="flex cursor-pointer items-center justify-center rounded-md border border-[color:var(--os-line)] p-2 md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div
          id="os-mobile-menu"
          ref={panelRef}
          className="border-t border-[color:var(--os-line)] bg-[color:var(--os-pearl)] px-4 py-4 md:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {LINKS.map(([label, to]) => (
              <Link
                key={to}
                to={to}
                className="cursor-pointer rounded-md px-3 py-3 text-sm hover:bg-[rgba(14,14,12,0.05)]"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            <Link
              to="/login"
              className="cursor-pointer whitespace-nowrap rounded-md border border-[color:var(--os-line)] px-4 py-3 text-center text-sm font-medium"
            >
              Log in
            </Link>
            <SmartLaunchLink
              authedTo="/app"
              className="block cursor-pointer whitespace-nowrap rounded-md bg-[color:var(--os-ink)] px-4 py-3 text-center text-sm font-semibold text-[color:var(--os-pearl)]"
            >
              Launch OS
            </SmartLaunchLink>
          </div>
        </div>
      )}
    </header>
  );
};

export default OsNav;
