import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthState } from '@/hooks/useAuthState';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const authed = useAuthState();
  const location = useLocation();

  if (authed === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (!authed) {
    const redirect = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
}
