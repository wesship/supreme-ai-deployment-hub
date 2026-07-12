import { Helmet } from 'react-helmet-async';
import PublicPageShell from '@/components/shell/PublicPageShell';
import ChatPage from '@/pages/Chat';

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
      <section aria-label="D3VONN.IO Voice Studio workspace">
        <ChatPage />
      </section>
    </PublicPageShell>
  );
}
