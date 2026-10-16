import { useGlobalLanguage } from '../../../hooks/useGlobalLanguage';
import { useEffect, useState, useCallback, useRef } from 'react';
import Logo from './Logo';

const links = [
  { label: 'Platform', href: '#platform' },
  { label: 'AI Films', href: '#films' },
  { label: 'Infrastructure', href: '#infrastructure' },
  { label: 'About', href: '#about' },
];

export default function Navbar() {
  const locale = useGlobalLanguage();
  const navText = navTranslations[locale];
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
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
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const smoothScroll = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setOpen(false);
    }
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? 'border-b border-foreground-200/10 bg-background-100/60 backdrop-blur-2xl backdrop-saturate-150'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto max-w-[1680px] px-5 md:px-8">
          <div className="flex h-[68px] items-center justify-between gap-4">
            <Logo />

            <nav className="hidden items-center gap-3 xl:flex">
              {links.map((l) => (
                <a
                  key={navText[l.label as keyof typeof navText] || l.label}
                  href={l.href}
                  onClick={(e) => smoothScroll(e, l.href)}
                  className="group relative font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-200 transition-colors hover:text-foreground-900 cursor-pointer whitespace-nowrap"
                >
                  {navText[l.label as keyof typeof navText] || l.label}
                  <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-primary-500 transition-all duration-300 group-hover:w-full"></span>
                </a>
              ))}
              <a
                href="/marketplace"
                className="group relative font-mono text-[11px] uppercase tracking-[0.18em] text-secondary-300 transition-colors hover:text-secondary-400 cursor-pointer whitespace-nowrap"
              >
                Marketplace
                <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-secondary-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a
                href="/music"
                className="group relative font-mono text-[11px] uppercase tracking-[0.18em] text-primary-300 transition-colors hover:text-primary-400 cursor-pointer whitespace-nowrap"
              >
                Music Studio
                <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-primary-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a
                href="/voice-studio"
                className="group relative font-mono text-[11px] uppercase tracking-[0.18em] text-accent-300 transition-colors hover:text-accent-400 cursor-pointer whitespace-nowrap"
              >
                Voice Studio
                <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-accent-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a
                href="/agents"
                className="group relative font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-200 transition-colors hover:text-foreground-900 cursor-pointer whitespace-nowrap"
              >
                AI Agents
                <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-primary-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a
                href="/command-center"
                className="group relative font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-200 transition-colors hover:text-foreground-900 cursor-pointer whitespace-nowrap"
              >
                Command Core
                <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-primary-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground-300/80 2xl:flex">
                <span className="relative flex h-1.5 w-1.5 items-center justify-center">
                  <span className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-accent-500/60"></span>
                  <span className="relative h-1.5 w-1.5 rounded-full bg-accent-500"></span>
                </span>
                Systems active
              </span>
              <a
                href="/app"
                onClick={() => setOpen(false)}
                className="btn-primary hidden items-center gap-2 rounded-md px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white cursor-pointer whitespace-nowrap sm:inline-flex"
              >
                Launch D3VONN
              </a>
              <button
                onClick={() => setOpen(true)}
                className="flex h-10 w-10 items-center justify-center text-foreground-200 transition-colors hover:text-foreground-900 cursor-pointer xl:hidden"
                ref={trigger}
                aria-label="Open navigation"
                aria-expanded={open}
                aria-controls="approved-mobile-nav"
              >
                <i className="ri-menu-2-line text-2xl"></i>
              </button>
            </div>
          </div>
        </div>
        {scrolled && <div className="seam opacity-60"></div>}
      </header>

      {/* Mobile full-screen cinematic overlay */}
      {open && (
        <div ref={menu} id="approved-mobile-nav" role="dialog" aria-modal="true" aria-label="Navigation" className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-background-50/97 backdrop-blur-2xl">
          <div className="contour pointer-events-none absolute inset-0"></div>
          <div className="flex h-[68px] items-center justify-between px-5 md:px-8">
            <Logo />
            <button
              onClick={() => { setOpen(false); trigger.current?.focus(); }}
              className="flex h-10 w-10 items-center justify-center text-foreground-200 hover:text-foreground-900 cursor-pointer"
              aria-label="Close menu"
            >
              <i className="ri-close-line text-3xl"></i>
            </button>
          </div>
          <nav aria-label="Primary navigation" className="flex flex-1 flex-col justify-center px-7">
            <p className="mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground-300/70">
              D3VONN NETWORK // NAVIGATION
            </p>
            {links.map((l, i) => (
              <a
                key={navText[l.label as keyof typeof navText] || l.label}
                href={l.href}
                onClick={(e) => smoothScroll(e, l.href)}
                className="animate-fade-up group flex items-baseline justify-between border-b border-foreground-200/10 py-5 cursor-pointer"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="font-heading text-3xl font-bold tracking-tight text-foreground-900 transition-colors group-hover:text-primary-300">
                  {navText[l.label as keyof typeof navText] || l.label}
                </span>
                <span className="font-mono text-[10px] text-foreground-300/70">0{i + 1}</span>
              </a>
            ))}
            <a
              href="/marketplace"
              onClick={() => setOpen(false)}
              className="animate-fade-up group flex items-baseline justify-between border-b border-foreground-200/10 py-5 cursor-pointer"
              style={{ animationDelay: '240ms' }}
            >
              <span className="font-heading text-3xl font-bold tracking-tight text-secondary-400 transition-colors group-hover:text-secondary-500">
                Marketplace
              </span>
              <span className="font-mono text-[10px] text-foreground-300/70">05</span>
            </a>
            <a
              href="/music"
              onClick={() => setOpen(false)}
              className="animate-fade-up group flex items-baseline justify-between border-b border-foreground-200/10 py-5 cursor-pointer"
              style={{ animationDelay: '300ms' }}
            >
              <span className="font-heading text-3xl font-bold tracking-tight text-primary-400 transition-colors hover:text-primary-500">
                Music Studio
              </span>
              <span className="font-mono text-[10px] text-foreground-300/70">06</span>
            </a>
            <a
              href="/voice-studio"
              onClick={() => setOpen(false)}
              className="animate-fade-up group flex items-baseline justify-between border-b border-foreground-200/10 py-5 cursor-pointer"
              style={{ animationDelay: '360ms' }}
            >
              <span className="font-heading text-3xl font-bold tracking-tight text-accent-400 transition-colors hover:text-accent-500">
                Voice Studio
              </span>
              <span className="font-mono text-[10px] text-foreground-300/70">07</span>
            </a>
            <a
              href="/agents"
              onClick={() => setOpen(false)}
              className="animate-fade-up group flex items-baseline justify-between border-b border-foreground-200/10 py-5 cursor-pointer"
              style={{ animationDelay: '420ms' }}
            >
              <span className="font-heading text-3xl font-bold tracking-tight text-foreground-900 transition-colors group-hover:text-primary-300">
                AI Agents
              </span>
              <span className="font-mono text-[10px] text-foreground-300/70">08</span>
            </a>
            <a
              href="/command-center"
              onClick={() => setOpen(false)}
              className="animate-fade-up group flex items-baseline justify-between border-b border-foreground-200/10 py-5 cursor-pointer"
              style={{ animationDelay: '480ms' }}
            >
              <span className="font-heading text-3xl font-bold tracking-tight text-foreground-900 transition-colors group-hover:text-primary-300">
                Command Core
              </span>
              <span className="font-mono text-[10px] text-foreground-300/70">09</span>
            </a>
          </nav>
          <div className="px-7 pb-10">
            <a
              href="/app"
              onClick={() => setOpen(false)}
              className="btn-primary flex w-full items-center justify-center gap-2 rounded-md py-4 font-mono text-xs uppercase tracking-[0.2em] text-white cursor-pointer"
            >
              Launch D3VONN
            </a>
          </div>
        </div>
      )}
    </>
  );
}
const navTranslations: Record<import('../../../lib/global-language').SupportedLocale, Record<string, string>> = {
 en: { Platform:'Platform','AI Films':'AI Films',Infrastructure:'Infrastructure',About:'About',marketplace:'Marketplace',music:'Music Studio',voice:'Voice Studio',agents:'AI Agents',core:'Command Core',launch:'Launch D3VONN' },
 es: { Platform:'Plataforma','AI Films':'Cine IA',Infrastructure:'Infraestructura',About:'Acerca de',marketplace:'Mercado',music:'Estudio musical',voice:'Estudio de voz',agents:'Agentes IA',core:'Centro de mando',launch:'Iniciar D3VONN' },
 fr: { Platform:'Plateforme','AI Films':'Films IA',Infrastructure:'Infrastructure',About:'À propos',marketplace:'Marché',music:'Studio musical',voice:'Studio vocal',agents:'Agents IA',core:'Centre de commande',launch:'Lancer D3VONN' },
 de: { Platform:'Plattform','AI Films':'KI-Filme',Infrastructure:'Infrastruktur',About:'Über uns',marketplace:'Marktplatz',music:'Musikstudio',voice:'Sprachstudio',agents:'KI-Agenten',core:'Kommandozentrale',launch:'D3VONN starten' },
 pt: { Platform:'Plataforma','AI Films':'Filmes IA',Infrastructure:'Infraestrutura',About:'Sobre',marketplace:'Mercado',music:'Estúdio musical',voice:'Estúdio de voz',agents:'Agentes IA',core:'Central de comando',launch:'Iniciar D3VONN' },
 ar: { Platform:'المنصة','AI Films':'أفلام الذكاء الاصطناعي',Infrastructure:'البنية التحتية',About:'حول',marketplace:'السوق',music:'استوديو الموسيقى',voice:'استوديو الصوت',agents:'وكلاء الذكاء الاصطناعي',core:'مركز القيادة',launch:'تشغيل D3VONN' },
 zh: { Platform:'平台','AI Films':'AI 电影',Infrastructure:'基础设施',About:'关于',marketplace:'市场',music:'音乐工作室',voice:'语音工作室',agents:'AI 智能体',core:'指挥中心',launch:'启动 D3VONN' },
 hi: { Platform:'प्लेटफ़ॉर्म','AI Films':'एआई फ़िल्में',Infrastructure:'अवसंरचना',About:'परिचय',marketplace:'मार्केटप्लेस',music:'संगीत स्टूडियो',voice:'वॉइस स्टूडियो',agents:'एआई एजेंट',core:'कमांड केंद्र',launch:'D3VONN शुरू करें' },
};
