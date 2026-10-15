import { useEffect, useState, useCallback, useRef } from 'react';
import Logo from './Logo';

const groups = [
  { label: 'Studios', links: [
    { label: 'AI Films', href: '/ai-films' },
    { label: 'Music Studio', href: '/music' },
    { label: 'Voice Studio', href: '/voice-studio' },
  ] },
  { label: 'Resources', links: [
    { label: 'AI Agents', href: '/agents' },
    { label: 'Command Core', href: '/command-center' },
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'About D3VONN', href: '#about' },
  ] },
];
const links = [
  { label: 'Platform', href: '#platform' },
  { label: 'Infrastructure', href: '#infrastructure' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const desktopNav = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!activeGroup) return;
    const onPointer = (event: PointerEvent) => {
      if (!desktopNav.current?.contains(event.target as Node)) setActiveGroup(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        desktopNav.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus();
        setActiveGroup(null);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [activeGroup]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const close = () => { setOpen(false); trigger.current?.focus(); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const controls = menu.current?.querySelectorAll<HTMLElement>('a, button');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    // Avoid an invisible modal/body lock if the viewport grows to desktop width.
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onResize = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', onResize);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener('change', onResize);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const navigate = useCallback((event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setActiveGroup(null);
    setOpen(false);
    if (!href.startsWith('#')) return;
    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;
    event.preventDefault();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    // Keep keyboard navigation on the section reached, outside the closed dialog.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <header className={`signal-header ${scrolled ? 'signal-header--scrolled' : ''}`}>
        <div className="signal-shell signal-header__inner">
          <Logo />
          <nav ref={desktopNav} className="signal-desktop-nav" aria-label="Primary navigation" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveGroup(null);
          }}>
            <a href="#platform" onClick={(event) => navigate(event, '#platform')}>Platform</a>
            {groups.map((group) => (
              <div className="signal-nav-group" key={group.label}>
                <button type="button" aria-expanded={activeGroup === group.label} aria-controls={`signal-nav-${group.label.toLowerCase()}`} onClick={() => setActiveGroup(activeGroup === group.label ? null : group.label)}>
                  {group.label}<i className="ri-arrow-right-line signal-chevron" aria-hidden="true" />
                </button>
                {activeGroup === group.label && (
                  <div id={`signal-nav-${group.label.toLowerCase()}`} className="signal-nav-panel">
                    <p>{group.label === 'Studios' ? 'Create with D3VONN' : 'Explore the ecosystem'}</p>
                    {group.links.map((link) => <a key={link.href} href={link.href} onClick={(event) => navigate(event, link.href)}>{link.label}<i className="ri-arrow-right-line" aria-hidden="true" /></a>)}
                  </div>
                )}
              </div>
            ))}
            <a href="#infrastructure" onClick={(event) => navigate(event, '#infrastructure')}>Infrastructure</a>
          </nav>
          <div className="signal-header__actions">
            <a href="/app" className="btn-primary signal-launch">Launch D3VONN<i className="ri-arrow-right-line" aria-hidden="true" /></a>
            <button type="button" className="signal-menu-trigger" ref={trigger} aria-label="Open navigation" aria-expanded={open} aria-controls="approved-mobile-nav" onClick={() => { setActiveGroup(null); setOpen(true); }}><i className="ri-menu-2-line" aria-hidden="true" /></button>
          </div>
        </div>
      </header>
      {open && (
        <div ref={menu} id="approved-mobile-nav" role="dialog" aria-modal="true" aria-label="Navigation" className="signal-mobile-nav">
          <div className="signal-mobile-nav__header"><Logo /><button type="button" aria-label="Close menu" onClick={() => { setOpen(false); trigger.current?.focus(); }}><i className="ri-close-line" aria-hidden="true" /></button></div>
          <nav aria-label="Mobile navigation">
            <p className="signal-eyebrow">Your command layer</p>
            {links.map((link) => <a className="signal-mobile-nav__main" key={link.href} href={link.href} onClick={(event) => navigate(event, link.href)}>{link.label}<i className="ri-arrow-right-line" aria-hidden="true" /></a>)}
            {groups.map((group) => <div className="signal-mobile-nav__group" key={group.label}><p className="signal-eyebrow">{group.label}</p>{group.links.map((link) => <a key={link.href} href={link.href} onClick={(event) => navigate(event, link.href)}>{link.label}</a>)}</div>)}
            <a href="/app" className="btn-primary signal-mobile-nav__launch" onClick={() => setOpen(false)}>Launch D3VONN<i className="ri-arrow-right-line" aria-hidden="true" /></a>
          </nav>
        </div>
      )}
    </>
  );
}
