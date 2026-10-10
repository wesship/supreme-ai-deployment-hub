import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const safeRedirect = (value: string | null) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [message, setMessage] = useState('Completing sign in…');

  useEffect(() => {
    let cancelled = false;

    const completeAuth = async () => {
      const redirect = safeRedirect(params.get('redirect'));
      const code = params.get('code');
      const error = params.get('error_description') || params.get('error');

      if (error) {
        setMessage(error);
        window.setTimeout(() => navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true }), 1600);
        return;
      }

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        if (data.session) {
          navigate(redirect, { replace: true });
          return;
        }

        setMessage('No active session found. Returning to sign in…');
        window.setTimeout(() => navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true }), 1200);
      } catch (err) {
        if (cancelled) return;
        setMessage(err instanceof Error ? err.message : 'Authentication failed. Returning to sign in…');
        window.setTimeout(() => navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true }), 1600);
      }
    };

    completeAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020817] px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-blue-400/20 bg-blue-950/25 p-8 text-center shadow-[0_0_50px_rgba(59,130,246,0.22)] backdrop-blur-xl">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-300" />
        <h1 className="mt-6 text-2xl font-black tracking-wide">D3VONN.IO</h1>
        <p className="mt-3 text-sm text-blue-100/75">{message}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
