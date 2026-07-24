import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const safeRedirect = (value: string | null) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
};

const Login = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));
  const authCallbackUrl = useMemo(
    () => `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
    [redirect]
  );
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const emailSubmittingRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(redirect, { replace: true });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate(redirect, { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate, redirect]);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setGoogleError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authCallbackUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        setGoogleError(error.message || 'Google sign-in failed');
        setGoogleLoading(false);
      }
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : 'Google sign-in failed');
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmitCapture = async (event: FormEvent<HTMLDivElement>) => {
    const form = event.target;

    // Supabase Auth UI 0.4.x keeps its own email/password state. Browser
    // autofill and automation can update the real inputs without updating
    // that state, causing the library to submit empty credentials. The
    // rendered controls do not consistently expose name attributes, so read
    // them by their stable input types inside the submitted form.
    if (!(form instanceof HTMLFormElement) || form.id !== 'auth-sign-in') return;

    event.preventDefault();
    event.stopPropagation();

    if (emailSubmittingRef.current) return;

    const email =
      form.querySelector<HTMLInputElement>('input[type="email"]')?.value.trim() ?? '';
    const password =
      form.querySelector<HTMLInputElement>('input[type="password"]')?.value ?? '';

    if (!email || !password) {
      setEmailError('Enter your email and password.');
      return;
    }

    emailSubmittingRef.current = true;
    setEmailLoading(true);
    setEmailError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setEmailError(error.message || 'Email sign-in failed');
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Email sign-in failed');
    } finally {
      emailSubmittingRef.current = false;
      setEmailLoading(false);
    }
  };

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <D3vonnPageBanner title="Welcome to D3VONN.IO" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="relative bg-card/60 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="absolute top-3 right-3 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2 tracking-tight">
              D3VONN.IO
            </h1>
            <p className="text-muted-foreground">Enter the AI Ecosystem</p>
          </div>

          <Button
            onClick={handleGoogle}
            disabled={googleLoading}
            variant="outline"
            className="w-full mb-4 font-medium"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </Button>
          {googleError && (
            <p className="text-sm text-destructive mb-3 text-center">{googleError}</p>
          )}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">or email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div
            onSubmitCapture={handleEmailSubmitCapture}
            aria-busy={emailLoading}
          >
            <Auth
              supabaseClient={supabase as any}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#7080FF',
                      brandAccent: '#5C6FFF',
                      inputBackground: 'rgba(15, 23, 42, 0.5)',
                      inputText: 'white',
                      inputBorder: 'rgba(112, 128, 255, 0.3)',
                      inputBorderFocus: 'rgba(112, 128, 255, 0.8)',
                    },
                  },
                },
                className: {
                  container: 'space-y-4',
                  input: 'bg-background/50 border-border text-foreground',
                },
              }}
              providers={[]}
              view="sign_in"
              redirectTo={authCallbackUrl}
            />
          </div>
          {emailLoading && (
            <p role="status" className="text-sm text-muted-foreground mt-3 text-center">
              Signing in…
            </p>
          )}
          {emailError && (
            <p role="alert" className="text-sm text-destructive mt-3 text-center">
              {emailError}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
