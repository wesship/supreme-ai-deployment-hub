import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import AIFilms from './pages/AIFilms';
import ScrollToTop from './components/ScrollToTop';
import SkipToContent from './components/SkipToContent';
import SignalAtmosphere from './components/shell/SignalAtmosphere';
import { mountPageVoiceReader } from './lib/mountPageVoiceReader';
import { startRumCollection } from './lib/assurance/rum';
import { isLocalPreviewHost } from './lib/isLocalPreview';
import './App.css';
import './styles/signal-pages.css';

const CanonicalAppShell = lazy(() => import('./App').then((module) => ({ default: module.CanonicalAppShell })));
const Navbar = lazy(() => import('./components/Navbar'));
const FloatingChatWidget = lazy(() => import('./components/ai/FloatingChatWidget').then((module) => ({ default: module.FloatingChatWidget })));
const Toaster = lazy(() => import('./components/ui/sonner').then((module) => ({ default: module.Toaster })));
const Analytics = lazy(() => import('@vercel/analytics/react').then((module) => ({ default: module.Analytics })));

export function PublicFilmRoutes() {
  const { pathname } = useLocation();
  useEffect(mountPageVoiceReader, []);
  if (!/^\/(?:film|ai-films)\/?$/.test(pathname)) {
    return <Suspense fallback={<p role="status" className="p-6 text-white">Loading D3VONN.IO…</p>}><CanonicalAppShell /></Suspense>;
  }
  return (
    <>
      <ScrollToTop />
      <SkipToContent />
      <Suspense fallback={null}><Navbar /></Suspense>
      <main id="main-content" tabIndex={-1} className="min-h-screen focus:outline-none d3-signal-pages pt-16">
        <SignalAtmosphere />
        <div className="d3-signal-content"><AIFilms /></div>
      </main>
      <Suspense fallback={null}><FloatingChatWidget /></Suspense>
      <Suspense fallback={null}><Toaster />{!isLocalPreviewHost() && <Analytics />}</Suspense>
    </>
  );
}

export default function PublicFilmApp() {
  useEffect(() => { startRumCollection(); }, []);
  return <ThemeProvider attribute="class" defaultTheme="dark" enableSystem><BrowserRouter><PublicFilmRoutes /></BrowserRouter></ThemeProvider>;
}
