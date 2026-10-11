import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import Index from './pages/Index';
import ScrollToTop from './components/ScrollToTop';
import SkipToContent from './components/SkipToContent';
import { startRumCollection } from './lib/assurance/rum';
import { isLocalPreviewHost } from './lib/isLocalPreview';

const CanonicalAppShell = lazy(() => import('./App').then((module) => ({ default: module.CanonicalAppShell })));
const Analytics = lazy(() => import('@vercel/analytics/react').then((module) => ({ default: module.Analytics })));

/** All non-home navigation delegates to the existing routes and auth gates. */
export function PublicHomepageRoutes() {
  const { pathname } = useLocation();
  if (pathname !== '/') {
    return (
      <Suspense fallback={<p role="status" className="p-6 text-white">Loading D3VONN.IO…</p>}>
        <CanonicalAppShell />
      </Suspense>
    );
  }

  return (
    <>
      <ScrollToTop />
      <SkipToContent />
      <main id="main-content" tabIndex={-1} className="min-h-screen focus:outline-none">
        <Index />
      </main>
      <Suspense fallback={null}>{!isLocalPreviewHost() && <Analytics />}</Suspense>
    </>
  );
}

export default function PublicHomepageApp() {
  useEffect(() => { startRumCollection(); }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <BrowserRouter><PublicHomepageRoutes /></BrowserRouter>
    </ThemeProvider>
  );
}
