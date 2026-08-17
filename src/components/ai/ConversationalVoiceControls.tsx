import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MicOff, PhoneCall, Volume2 } from 'lucide-react';
import Vapi from '@vapi-ai/web';
import { toast } from 'sonner';
import { getVapiAssistantId, getVapiPublicKey } from '@/config/voice';
import { supabase } from '@/integrations/supabase/client';

interface ConversationalVoiceControlsProps {
  disabled?: boolean;
}

type InlineVapiAssistant = Record<string, unknown>;

type VoiceSessionResponse = {
  mode: 'inline-authenticated';
  expires_at: number;
  assistant: InlineVapiAssistant;
};

const PRODUCTION_API_URL = 'https://api.d3vonn.io';

const getApiBaseUrl = (): string =>
  (import.meta.env.VITE_API_URL?.trim() || PRODUCTION_API_URL).replace(/\/$/, '');

const readableError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || 'Unknown voice error');

/**
 * Request a short-lived assistant configuration tied to the signed-in D3VONN
 * user. The browser never receives a Vapi private key, provider credential, or
 * reusable webhook secret.
 */
const getInlineVoiceSession = async (): Promise<VoiceSessionResponse | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const response = await fetch(`${getApiBaseUrl()}/api/voice/session`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw new Error(`D3VONN voice session service returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as Partial<VoiceSessionResponse>;
  if (payload.mode !== 'inline-authenticated' || !payload.assistant) {
    throw new Error('D3VONN returned an invalid voice session configuration.');
  }
  return payload as VoiceSessionResponse;
};

/**
 * D3VONN.IO real-time voice control.
 *
 * The official Vapi Web SDK owns the browser call lifecycle. Vapi manages the
 * call and uses its configured ElevenLabs integration for text-to-speech; the
 * authenticated inline-assistant path binds server tool calls to the signed-in
 * D3VONN identity without exposing any private provider credential.
 */
export const ConversationalVoiceControls: React.FC<ConversationalVoiceControlsProps> = ({
  disabled = false,
}) => {
  const vapiPublicKey = getVapiPublicKey();
  const vapiAssistantId = getVapiAssistantId();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);

  useEffect(
    () => () => {
      const vapi = vapiRef.current;
      vapiRef.current = null;
      vapi?.removeAllListeners();
      void vapi?.stop();
    },
    [],
  );

  const ensureVapi = useCallback((): Vapi => {
    if (!vapiPublicKey) {
      throw new Error('Voice is not configured. Set VITE_VAPI_PUBLIC_KEY in the Vercel production environment.');
    }

    if (vapiRef.current) return vapiRef.current;

    const instance = new Vapi(vapiPublicKey);
    instance.on('call-start', () => {
      setConnected(true);
      setConnecting(false);
      toast.success('D3VONN voice assistant connected');
    });
    instance.on('call-end', () => {
      setConnected(false);
      setConnecting(false);
      setSpeaking(false);
      toast.info('D3VONN voice assistant disconnected');
    });
    instance.on('speech-start', () => setSpeaking(true));
    instance.on('speech-end', () => setSpeaking(false));
    instance.on('call-start-failed', (event) => {
      setConnected(false);
      setConnecting(false);
      setSpeaking(false);
      toast.error('Unable to connect D3VONN voice', { description: event.error });
    });
    instance.on('error', (error) => {
      setConnected(false);
      setConnecting(false);
      setSpeaking(false);
      toast.error('D3VONN voice error', { description: readableError(error) });
    });

    vapiRef.current = instance;
    return instance;
  }, [vapiPublicKey]);

  const start = useCallback(async () => {
    setConnecting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support microphone access.');
      }

      const vapi = ensureVapi();
      const inlineSession = await getInlineVoiceSession();
      const target = inlineSession?.assistant ?? vapiAssistantId;

      await vapi.start(target as Parameters<Vapi['start']>[0]);
      setConnected(true);
      setConnecting(false);
      toast.success(
        inlineSession
          ? 'Authenticated Hermes voice session started'
          : 'D3VONN voice session started',
        inlineSession
          ? undefined
          : { description: 'Sign in to enable authenticated Hermes tool execution.' },
      );
    } catch (error) {
      const message = readableError(error);
      toast.error('Unable to start D3VONN voice', { description: message });
      setConnected(false);
      setConnecting(false);
      setSpeaking(false);
    }
  }, [ensureVapi, vapiAssistantId]);

  const stop = useCallback(async () => {
    try {
      await vapiRef.current?.stop();
      setConnected(false);
      setConnecting(false);
      setSpeaking(false);
    } catch (error) {
      toast.error('Unable to end D3VONN voice', { description: readableError(error) });
    }
  }, []);

  const unavailable = disabled || connecting || !vapiPublicKey;
  const actionLabel = connected ? 'End D3VONN voice conversation' : 'Start D3VONN voice conversation';
  const title = !vapiPublicKey
    ? 'Voice configuration is unavailable'
    : connected
      ? 'End D3VONN voice conversation'
      : 'Start D3VONN voice with Vapi and ElevenLabs';

  return (
    <button
      type="button"
      onClick={connected ? stop : start}
      disabled={unavailable}
      aria-label={actionLabel}
      title={title}
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
        speaking ? <Volume2 className="h-4 w-4" /> : <MicOff className="h-4 w-4" />
      ) : (
        <PhoneCall className="h-4 w-4" />
      )}
    </button>
  );
};

export default ConversationalVoiceControls;
