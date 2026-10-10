import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { AudioLines, LockKeyhole, MessageSquareText, RadioTower, ShieldCheck } from 'lucide-react';
import PublicPageShell from '@/components/shell/PublicPageShell';
import VoiceInterface from '@/components/voice/VoiceInterface';
import ChatPage from '@/pages/Chat';
import ProductWorkspaceHero from '@/components/d3/ProductWorkspaceHero';
import { supabase } from '@/integrations/supabase/client';

const breadcrumbs = [{ label: 'Voice Studio' }, { label: 'AI Workspace' }];

function VoiceStudioChatWorkspace() {
  const [authResolved, setAuthResolved] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSignedIn(Boolean(data.session));
      setAuthResolved(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSignedIn(Boolean(session));
      setAuthResolved(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!authResolved) {
    return (
      <div
        className="flex min-h-40 items-center justify-center rounded-xl border border-white/10 bg-black/20 p-6"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-blue-300/30 border-t-blue-200" />
          <p className="mt-3 text-xs text-blue-100/60">Checking secure workspace access</p>
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <section
        aria-label="Authenticated text workspace"
        className="rounded-xl border border-white/10 bg-black/20 px-5 py-7 sm:px-7"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-500/10">
            <LockKeyhole className="h-5 w-5 text-blue-200" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Secure text and Hermes workspace</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              Public voice conversation remains available above. Sign in to unlock persistent text
              conversations and authenticated Hermes tool execution without exposing provider credentials.
            </p>
            <Link
              to="/login?redirect=/voice-studio"
              className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-blue-300/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20"
            >
              Sign in for secure workspace
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return <ChatPage />;
}

export default function VoiceStudio() {
  return (
    <PublicPageShell breadcrumbs={breadcrumbs} className="min-h-[calc(100dvh-8rem)]">
      <Helmet>
        <title>Voice Studio & AI Workspace — D3VONN.IO</title>
        <meta
          name="description"
          content="Use voice, text, file ingestion, and agent orchestration inside the secure D3VONN.IO AI workspace."
        />
        <link rel="canonical" href="https://d3vonn.io/voice-studio" />
      </Helmet>

      <section aria-label="D3VONN.IO Voice Studio workspace" className="d3-homepage-world min-h-screen px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <ProductWorkspaceHero
            status="Voice intelligence online"
            eyebrow="D3VONN.IO Voice Studio"
            title={<>Conversation,<br /><span className="text-blue-200">under command.</span></>}
            description="Operate voice, text, files, and agent orchestration from one governed communication workspace with clear context and enterprise-ready controls."
          >
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Spatial voice', AudioLines],
                ['Live sessions', RadioTower],
                ['AI conversation', MessageSquareText],
                ['Governed access', ShieldCheck],
              ].map(([label, Icon]) => (
                <div key={String(label)} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  {typeof Icon !== 'string' && <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />}
                  <div className="mt-3 text-xs font-semibold text-white">{String(label)}</div>
                </div>
              ))}
            </div>
          </ProductWorkspaceHero>

          <div className="d3-titanium-panel p-3 sm:p-5">
            <VoiceInterface />
          </div>

          <div className="d3-surface p-3 sm:p-5">
            <VoiceStudioChatWorkspace />
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
