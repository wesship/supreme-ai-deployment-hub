/** Keep the visible launcher light; activate chat and voice on the first click. */
import { useState } from 'react';
import { ChatLauncher } from './ChatLauncher';
import type ChatSession from './FloatingChatSession';

export function FloatingChatWidget() {
  const [Session, setSession] = useState<typeof ChatSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const openChat = async () => {
    if (loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const { default: LoadedSession } = await import('./FloatingChatSession');
      setSession(() => LoadedSession);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  // Keep the activated session mounted when closed to retain conversation/input state.
  if (Session) return <Session />;
  return <>
    <ChatLauncher onClick={openChat} loading={loading} />
    {loading && <span role="status" className="sr-only">Loading Devonn AI Chat</span>}
    {failed && <span role="alert" className="fixed bottom-24 right-6 z-50 max-w-64 rounded-lg bg-[#070d1a] p-3 text-sm text-white">
      Chat could not load. Select the chat button to retry.
    </span>}
  </>;
}

export default FloatingChatWidget;
