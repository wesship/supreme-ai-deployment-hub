import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

const ChatProvider = lazy(() => import("@/contexts/ChatContext").then(m => ({ default: m.ChatProvider })));
const DeploymentProvider = lazy(() => import("@/contexts/DeploymentContext").then(m => ({ default: m.DeploymentProvider })));
const APIProvider = lazy(() => import("@/contexts/APIContext").then(m => ({ default: m.APIProvider })));
const AGUIProvider = lazy(() => import("@/contexts/agui/AGUIContext").then(m => ({ default: m.AGUIProvider })));

export default function DeferredProviders({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  // These public surfaces use direct clients, not workspace contexts.
  // Wrapping them after first paint remounts the hero and restarts media loading.
  const isPublicPresentation = ['/', '/film', '/ai-films'].includes(pathname.replace(/\/$/, '') || '/');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isPublicPresentation) return;
    const id = (typeof window.requestIdleCallback === 'function')
      ? window.requestIdleCallback(() => setReady(true))
      : window.setTimeout(() => setReady(true), 50);
    return () => {
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id);
      } else {
        window.clearTimeout(id);
      }
    };
  }, [isPublicPresentation]);

  if (isPublicPresentation || !ready) return <>{children}</>;

  return (
    <Suspense fallback={<>{children}</>}>
      <DeploymentProvider>
        <APIProvider>
          <ChatProvider>
            <AGUIProvider>{children}</AGUIProvider>
          </ChatProvider>
        </APIProvider>
      </DeploymentProvider>
    </Suspense>
  );
}

