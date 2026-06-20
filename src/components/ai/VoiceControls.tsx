/**
 * Devonn.ai Voice Controls — Phase 4
 * Mic button (STT) and speaker button (TTS) for the chat UI.
 * Works with voiceService.ts (ElevenLabs TTS + Web Speech API / AssemblyAI STT).
 */

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import {
  speak,
  stopSpeaking,
  startListening,
  stopListening,
  isSpeaking,
  isListening,
  getVoiceState,
} from '../../services/ai/voiceService';
import { speak as speakBrowser } from '../../services/speech/speechSynthesisService';

interface VoiceControlsProps {
  /** Text to speak when TTS button is clicked */
  lastAssistantMessage?: string;
  /** Called when STT produces a final transcript */
  onTranscript?: (text: string) => void;
  /** Called with interim (partial) transcript for live display */
  onInterimTranscript?: (text: string) => void;
  /** Whether the chat is currently streaming (disables voice input) */
  isStreaming?: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  lastAssistantMessage,
  onTranscript,
  onInterimTranscript,
  isStreaming = false,
}) => {
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [sttActive, setSttActive] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const stopListenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const state = getVoiceState();
    setVoiceAvailable(state.isAvailable);
  }, []);

  // Poll speaking state
  useEffect(() => {
    const interval = setInterval(() => {
      setTtsSpeaking(isSpeaking());
      setSttActive(isListening());
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const handleTTS = async () => {
    if (ttsSpeaking) {
      stopSpeaking();
      setTtsSpeaking(false);
      return;
    }

    if (!lastAssistantMessage) return;

    setTtsLoading(true);
    try {
      // Primary: Premium ElevenLabs via backend proxy
      await speak(lastAssistantMessage);
    } catch (err) {
      console.warn('[VoiceControls] Premium TTS failed, falling back to browser speech:', err);
      try {
        // Fallback: Standard browser speech synthesis
        await speakBrowser(lastAssistantMessage);
      } catch (fallbackError) {
        console.error('[VoiceControls] All TTS methods failed:', fallbackError);
      }
    } finally {
      setTtsLoading(false);
      setTtsSpeaking(false);
    }
  };

  const handleSTT = () => {
    if (sttActive) {
      stopListenRef.current?.();
      stopListening();
      setSttActive(false);
      return;
    }

    setSttActive(true);
    const stop = startListening(
      (text, isFinal) => {
        if (isFinal) {
          onTranscript?.(text);
          stopListenRef.current?.();
          setSttActive(false);
        } else {
          onInterimTranscript?.(text);
        }
      },
      (error) => {
        console.error('[VoiceControls] STT error:', error);
        setSttActive(false);
      },
      () => setSttActive(false)
    );
    stopListenRef.current = stop;
  };

  if (!voiceAvailable) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {/* TTS Button */}
      {lastAssistantMessage && (
        <button
          onClick={handleTTS}
          disabled={ttsLoading || isStreaming}
          title={ttsSpeaking ? 'Stop speaking' : 'Read aloud'}
          style={{
            padding: '4px',
            background: 'none',
            border: 'none',
            cursor: ttsLoading || isStreaming ? 'not-allowed' : 'pointer',
            color: ttsSpeaking ? '#7080FF' : ttsLoading ? '#F59E0B' : 'rgba(255,255,255,0.3)',
            transition: 'color 0.2s',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {ttsLoading ? (
            <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
          ) : ttsSpeaking ? (
            <VolumeX style={{ width: '14px', height: '14px' }} />
          ) : (
            <Volume2 style={{ width: '14px', height: '14px' }} />
          )}
        </button>
      )}

      {/* STT Button */}
      <button
        onClick={handleSTT}
        disabled={isStreaming}
        title={sttActive ? 'Stop listening' : 'Speak your message'}
        style={{
          padding: '4px',
          background: sttActive ? 'rgba(112,128,255,0.1)' : 'none',
          border: sttActive ? '1px solid rgba(112,128,255,0.3)' : '1px solid transparent',
          cursor: isStreaming ? 'not-allowed' : 'pointer',
          color: sttActive ? '#7080FF' : 'rgba(255,255,255,0.3)',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          borderRadius: '4px',
        }}
      >
        {sttActive ? (
          <MicOff style={{ width: '14px', height: '14px' }} />
        ) : (
          <Mic style={{ width: '14px', height: '14px' }} />
        )}
      </button>
    </div>
  );
};

export default VoiceControls;
