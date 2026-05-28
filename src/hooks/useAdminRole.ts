import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AdminRoleStatus = 'loading' | 'allowed' | 'denied' | 'unauthenticated';

/**
 * Checks whether the currently logged-in Supabase user has the 'admin' role
 * in the public.user_roles table.
 *
 * Returns:
 *   - 'loading'         — session check in progress
 *   - 'unauthenticated' — no active Supabase session
 *   - 'allowed'         — user has admin role
 *   - 'denied'          — user is logged in but does NOT have admin role
 */
export function useAdminRole() {
  const [status, setStatus] = useState<AdminRoleStatus>('loading');
  const [userId, setUserId] = useState<string | null>(null);

  const check = useCallback(async () => {
    setStatus('loading');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) {
        setStatus('unauthenticated');
        setUserId(null);
        return;
      }

      const user = sessionData.session.user;
      setUserId(user.id);

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        // If the table doesn't exist yet (migration not run), treat as denied
        console.warn('[useAdminRole] user_roles query error:', error.message);
        setStatus('denied');
        return;
      }

      setStatus(data ? 'allowed' : 'denied');
    } catch (err) {
      console.error('[useAdminRole] unexpected error:', err);
      setStatus('denied');
    }
  }, []);

  useEffect(() => {
    check();

    // Re-check when auth state changes (login / logout)
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [check]);

  return { status, userId, recheck: check };
}
