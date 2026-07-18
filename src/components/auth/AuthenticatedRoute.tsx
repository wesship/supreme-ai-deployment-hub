import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface AuthenticatedRouteProps {
  children: React.ReactNode;
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Protects application routes with the canonical Supabase session.
 * Preserves the requested path so login can return the user to their workspace.
 */
export default function AuthenticatedRoute({ children }: AuthenticatedRouteProps) {
  const location = useLocation();
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setStatus(!error && data.session ? 'authenticated' : 'unauthenticated');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setStatus(session ? 'authenticated' : 'unauthenticated');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (status === 'loading') {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-hidden="true"
          />
          <p className="text-sm text-gray-400">Verifying your session…</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    const redirect = encodeURIComponent(
      `${location.pathname}${location.search}${location.hash}`,
    );
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
}
