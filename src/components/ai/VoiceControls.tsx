import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import {
  getVoiceState,
  isListening,
  isSpeaking,
  speak,
  startListening,
  stopListening,
  stopSpeaking,
} from '../../services/ai/voiceService';
import { speak as speakBrowser } from '../../services/speech/speechSynthesisService';

interface VoiceControlsProps {
  lastAssistantMessage?: string;
  onTranscript?: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  isStreaming?: boolean;
}

/**
 * Resilient voice controls.
 *
 * The standard microphone and read-aloud controls remain available regardless
 * of whether an ElevenLabs conversational agent ID is configured. This avoids
 * replacing the working browser/backend voice path with a single provider-only
 * button that can fail when the remote agent is private, unavailable, or
 * misconfigured.
 */
export const VoiceControls: React.FC<VoiceControlsProps> = (props) => (
  <LegacyVoiceControls {...props} />
);

const LegacyVoiceControls: React.FC<VoiceControlsProps> = ({
  lastAssistantMessage,
  onTranscript,
  onInterimTranscript,
  isStreaming = false,
}) => {
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [sttActive, setSttActive] = useState(false);
  const [sttAvailable, setSttAvailable] = useState(true);
  const stopListenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSttAvailable(getVoiceState().sttAvailable);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTtsSpeaking(isSpeaking());
      setSttActive(isListening());
    }, 300);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(
    () => () => {
      stopListenRef.current?.();
      stopListening();
      stopSpeaking();
    },
    [],
  );

  const handleTTS = async () => {
    if (ttsSpeaking) {
      stopSpeaking();
      setTtsSpeaking(false);
      return;
    }
    if (!lastAssistantMessage) {
      toast.info('There is no completed assistant response to read yet.');
      return;
    }

    setTtsLoading(true);
    try {
      await speak(lastAssistantMessage);
    } catch (error) {
      console.warn('[VoiceControls] Backend TTS failed; trying browser speech.', error);
      try {
        await speakBrowser(lastAssistantMessage);
        toast.info('Using your browser voice because premium voice was unavailable.');
      } catch (fallbackError) {
        toast.error('Voice playback failed', {
          description: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
      }
    } finally {
      setTtsLoading(false);
      setTtsSpeaking(false);
    }
  };

  const stopMicrophone = () => {
    stopListenRef.current?.();
    stopListenRef.current = null;
    stopListening();
    setSttActive(false);
  };

  const handleSTT = () => {
    if (sttActive) {
      stopMicrophone();
      return;
    }
    if (!sttAvailable) {
      toast.error('Microphone input is unavailable in this browser or device.');
      return;
    }

    setSttActive(true);
    toast.info('Listening…', { description: 'Speak now. Your words will appear in the message box.' });
    const stop = startListening(
      (text, isFinal) => {
        if (isFinal) {
          onTranscript?.(text);
          stopMicrophone();
          toast.success('Voice captured');
        } else {
          onInterimTranscript?.(text);
        }
      },
      (error) => {
        stopMicrophone();
        toast.error('Microphone failed', { description: error });
      },
      () => {
        stopListenRef.current = null;
        setSttActive(false);
      },
    );
    stopListenRef.current = stop;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button
        type="button"
        onClick={handleTTS}
        disabled={ttsLoading || isStreaming || !lastAssistantMessage}
        title={ttsSpeaking ? 'Stop speaking' : 'Read the latest response aloud'}
        aria-label={ttsSpeaking ? 'Stop speaking' : 'Read the latest response aloud'}
        style={{
          padding: '4px', background: 'none', border: '1px solid transparent',
          cursor: ttsLoading || isStreaming || !lastAssistantMessage ? 'not-allowed' : 'pointer',
          color: ttsSpeaking ? '#7080FF' : ttsLoading ? '#F59E0B' : 'rgba(255,255,255,0.45)',
          opacity: lastAssistantMessage ? 1 : 0.45, transition: 'color 0.2s',
          display: 'flex', alignItems: 'center', borderRadius: '4px',
        }}
      >
        {ttsLoading ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
          : ttsSpeaking ? <VolumeX style={{ width: 14, height: 14 }} />
            : <Volume2 style={{ width: 14, height: 14 }} />}
      </button>

      <button
        type="button"
        onClick={handleSTT}
        disabled={isStreaming || !sttAvailable}
        title={sttActive ? 'Stop listening' : 'Speak your message'}
        aria-label={sttActive ? 'Stop listening' : 'Speak your message'}
        style={{
          padding: '4px', background: sttActive ? 'rgba(112,128,255,0.1)' : 'none',
          border: sttActive ? '1px solid rgba(112,128,255,0.3)' : '1px solid transparent',
          cursor: isStreaming || !sttAvailable ? 'not-allowed' : 'pointer',
          color: sttActive ? '#7080FF' : 'rgba(255,255,255,0.45)', opacity: sttAvailable ? 1 : 0.45,
          transition: 'all 0.2s', display: 'flex', alignItems: 'center', borderRadius: '4px',
        }}
      >
        {sttActive ? <MicOff style={{ width: 14, height: 14 }} /> : <Mic style={{ width: 14, height: 14 }} />}
      </button>
    </div>
  );
};

export default VoiceControls;
