import { Helmet } from 'react-helmet-async';
import { AudioLines, MessageSquareText, RadioTower, ShieldCheck } from 'lucide-react';
import PublicPageShell from '@/components/shell/PublicPageShell';
import VoiceInterface from '@/components/voice/VoiceInterface';
import ChatPage from '@/pages/Chat';
import ProductWorkspaceHero from '@/components/d3/ProductWorkspaceHero';

const breadcrumbs = [{ label: 'Voice Studio' }, { label: 'AI Workspace' }];

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
            <ChatPage />
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
