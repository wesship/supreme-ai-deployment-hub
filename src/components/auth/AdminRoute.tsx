import { Navigate } from 'react-router-dom';
import { useAdminRole } from '@/hooks/useAdminRole';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * AdminRoute — wraps a route and enforces admin-only access.
 *
 * Behaviour:
 *   loading         → shows a full-screen spinner
 *   unauthenticated → redirects to /login
 *   denied          → redirects to /unauthorized
 *   allowed         → renders children
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  const { status } = useAdminRole();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (status === 'denied') {
    return <Navigate to="/unauthorized" replace />;
  }

  // status === 'allowed'
  return <>{children}</>;
}
