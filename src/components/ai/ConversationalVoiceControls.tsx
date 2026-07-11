import React, { useCallback, useState } from 'react';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { useConversation } from '@elevenlabs/react';
import { toast } from 'sonner';

interface ConversationalVoiceControlsProps {
  disabled?: boolean;
}

/**
 * Real-time conversational voice surface powered by an ElevenLabs Agent.
 * The agent ID is public configuration; the ElevenLabs API key remains server-side.
 */
export const ConversationalVoiceControls: React.FC<ConversationalVoiceControlsProps> = ({
  disabled = false,
}) => {
  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID?.trim();
  const [connecting, setConnecting] = useState(false);

  const conversation = useConversation({
    onConnect: () => toast.success('Voice assistant connected'),
    onDisconnect: () => toast.info('Voice assistant disconnected'),
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Voice assistant error', { description: message });
    },
  });

  const start = useCallback(async () => {
    if (!agentId) {
      toast.error('Voice assistant is not configured', {
        description: 'Set VITE_ELEVENLABS_AGENT_ID in the Vercel production environment.',
      });
      return;
    }

    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ agentId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Unable to start voice conversation', { description: message });
    } finally {
      setConnecting(false);
    }
  }, [agentId, conversation]);

  const stop = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Unable to end voice conversation', { description: message });
    }
  }, [conversation]);

  const connected = conversation.status === 'connected';
  const unavailable = disabled || connecting;

  return (
    <button
      type="button"
      onClick={connected ? stop : start}
      disabled={unavailable}
      aria-label={connected ? 'End voice conversation' : 'Start voice conversation'}
      title={connected ? 'End ElevenLabs voice conversation' : 'Start ElevenLabs voice conversation'}
      className="relative flex items-center justify-center rounded-md border border-transparent p-1 transition-all disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        color: connected ? '#7080FF' : 'rgba(255,255,255,0.45)',
        background: connected ? 'rgba(112,128,255,0.12)' : 'transparent',
        borderColor: connected ? 'rgba(112,128,255,0.35)' : 'transparent',
      }}
    >
      {connecting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : connected ? (
        conversation.isSpeaking ? <Volume2 className="h-4 w-4" /> : <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
};

export default ConversationalVoiceControls;
