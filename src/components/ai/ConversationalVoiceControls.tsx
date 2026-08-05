import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, PhoneCall, Volume2 } from 'lucide-react';
import { useConversation } from '@elevenlabs/react';
import { toast } from 'sonner';

interface ConversationalVoiceControlsProps {
  disabled?: boolean;
}

type VoiceProvider = 'vapi' | 'elevenlabs';
type VapiInstance = {
  start: (assistantId?: string) => Promise<unknown> | unknown;
  stop: () => Promise<unknown> | unknown;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeAllListeners?: () => void;
};

declare global {
  interface Window {
    vapiSDK?: {
      run: (config: {
        apiKey: string;
        assistant: string;
        config?: Record<string, unknown>;
      }) => VapiInstance;
    };
  }
}

const VAPI_SCRIPT_ID = 'd3vonn-vapi-web-sdk';
const VAPI_SCRIPT_URL =
  'https://cdn.jsdelivr.net/gh/VapiAI/client-sdk-html-script-tag@749efa096d174c61d34e2e7d875b214709a497cc/dist/assets/index.js';

const loadVapiScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.vapiSDK) {
      resolve();
      return;
    }

    const existing = document.getElementById(VAPI_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load Vapi SDK.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = VAPI_SCRIPT_ID;
    script.src = VAPI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Vapi SDK.'));
    document.head.appendChild(script);
  });

/**
 * D3VONN.IO real-time voice control.
 *
 * Vapi is preferred for browser/PSTN orchestration when configured. ElevenLabs
 * remains the direct browser fallback. Only publishable IDs/keys are read by
 * the browser; all private provider credentials remain server-side.
 */
export const ConversationalVoiceControls: React.FC<ConversationalVoiceControlsProps> = ({
  disabled = false,
}) => {
  const configuredProvider = import.meta.env.VITE_VOICE_PROVIDER?.trim();
  const vapiPublicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY?.trim();
  const vapiAssistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID?.trim();
  const elevenLabsAgentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID?.trim();

  const provider: VoiceProvider = useMemo(
    () =>
      configuredProvider === 'vapi' || (vapiPublicKey && vapiAssistantId)
        ? 'vapi'
        : 'elevenlabs',
    [configuredProvider, vapiAssistantId, vapiPublicKey],
  );

  const [connecting, setConnecting] = useState(false);
  const [vapiConnected, setVapiConnected] = useState(false);
  const [vapiSpeaking, setVapiSpeaking] = useState(false);
  const vapiRef = useRef<VapiInstance | null>(null);

  const conversation = useConversation({
    onConnect: () => toast.success('D3VONN voice assistant connected'),
    onDisconnect: () => toast.info('D3VONN voice assistant disconnected'),
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Voice assistant error', { description: message });
    },
  });

  useEffect(
    () => () => {
      vapiRef.current?.removeAllListeners?.();
      void vapiRef.current?.stop();
    },
    [],
  );

  const ensureVapi = useCallback(async (): Promise<VapiInstance> => {
    if (!vapiPublicKey || !vapiAssistantId) {
      throw new Error('Set VITE_VAPI_PUBLIC_KEY and VITE_VAPI_ASSISTANT_ID in Vercel.');
    }

    if (vapiRef.current) return vapiRef.current;

    await loadVapiScript();
    if (!window.vapiSDK) throw new Error('Vapi SDK did not initialize.');

    const instance = window.vapiSDK.run({
      apiKey: vapiPublicKey,
      assistant: vapiAssistantId,
      config: {
        position: 'bottom-right',
        offset: '40px',
        width: '0px',
        height: '0px',
      },
    });

    instance.on?.('call-start', () => {
      setVapiConnected(true);
      setConnecting(false);
      toast.success('D3VONN Vapi call connected');
    });
    instance.on?.('call-end', () => {
      setVapiConnected(false);
      setVapiSpeaking(false);
      toast.info('D3VONN Vapi call ended');
    });
    instance.on?.('speech-start', () => setVapiSpeaking(true));
    instance.on?.('speech-end', () => setVapiSpeaking(false));
    instance.on?.('error', (error: unknown) => {
      setVapiConnected(false);
      setConnecting(false);
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Vapi voice error', { description: message });
    });

    vapiRef.current = instance;
    return instance;
  }, [vapiAssistantId, vapiPublicKey]);

  const start = useCallback(async () => {
    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      if (provider === 'vapi') {
        const vapi = await ensureVapi();
        await vapi.start(vapiAssistantId);
      } else {
        if (!elevenLabsAgentId) {
          throw new Error(
            'Set VITE_VAPI_PUBLIC_KEY and VITE_VAPI_ASSISTANT_ID, or configure VITE_ELEVENLABS_AGENT_ID.',
          );
        }
        await conversation.startSession({ agentId: elevenLabsAgentId });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Unable to start D3VONN voice', { description: message });
      setConnecting(false);
    }
  }, [conversation, elevenLabsAgentId, ensureVapi, provider, vapiAssistantId]);

  const stop = useCallback(async () => {
    try {
      if (provider === 'vapi') {
        await vapiRef.current?.stop();
        setVapiConnected(false);
        setVapiSpeaking(false);
      } else {
        await conversation.endSession();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Unable to end D3VONN voice', { description: message });
    }
  }, [conversation, provider]);

  const connected = provider === 'vapi' ? vapiConnected : conversation.status === 'connected';
  const speaking = provider === 'vapi' ? vapiSpeaking : conversation.isSpeaking;
  const unavailable = disabled || connecting;

  return (
    <button
      type="button"
      onClick={connected ? stop : start}
      disabled={unavailable}
      aria-label={connected ? 'End D3VONN voice conversation' : 'Start D3VONN voice conversation'}
      title={
        connected
          ? 'End D3VONN voice conversation'
          : `Start D3VONN voice with ${provider === 'vapi' ? 'Vapi' : 'ElevenLabs'}`
      }
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
      ) : provider === 'vapi' ? (
        <PhoneCall className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
};

export default ConversationalVoiceControls;
