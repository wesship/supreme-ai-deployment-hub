/**
 * Devonn.ai Voice Service — Phase 4
 * Text-to-Speech: ElevenLabs API
 * Speech-to-Text: AssemblyAI (streaming transcription via WebSocket)
 * Voice-ready architecture for future GPT-4o Realtime integration.
 */

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const ASSEMBLYAI_API_KEY = import.meta.env.VITE_ASSEMBLYAI_API_KEY;

// Default ElevenLabs voice — "Rachel" (neutral, clear, professional)
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const TTS_MODEL = 'eleven_turbo_v2_5'; // lowest latency model

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TTSOptions {
  voiceId?: string;
  model?: string;
  stability?: number;       // 0–1
  similarityBoost?: number; // 0–1
  speed?: number;           // 0.7–1.2
}

export interface STTResult {
  text: string;
  confidence: number;
  words?: Array<{ text: string; start: number; end: number; confidence: number }>;
}

export interface VoiceState {
  isSpeaking: boolean;
  isListening: boolean;
  isAvailable: boolean;
  ttsAvailable: boolean;
  sttAvailable: boolean;
}

// ─── TTS: ElevenLabs ──────────────────────────────────────────────────────────

let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;

/**
 * Convert text to speech using ElevenLabs and play it.
 * Returns a promise that resolves when audio finishes playing.
 */
export async function speak(text: string, options: TTSOptions = {}): Promise<void> {
  if (!ELEVENLABS_API_KEY) {
    console.warn('[Voice] ElevenLabs API key not configured (VITE_ELEVENLABS_API_KEY)');
    return;
  }

  // Stop any currently playing audio
  stopSpeaking();

  const voiceId = options.voiceId || DEFAULT_VOICE_ID;
  const model = options.model || TTS_MODEL;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarityBoost ?? 0.75,
          speed: options.speed ?? 1.0,
        },
        output_format: 'mp3_44100_128',
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs TTS error ${response.status}: ${err}`);
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    currentAudioUrl = audioUrl;

    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onerror = (e) => {
      cleanup();
      reject(new Error(`Audio playback error: ${String(e)}`));
    };

    audio.play().catch(reject);
  });
}

function cleanup() {
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
  currentAudio = null;
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    cleanup();
  }
}

export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

// ─── STT: Browser Web Speech API (primary) + AssemblyAI (fallback) ────────────

let recognition: SpeechRecognition | null = null;

/**
 * Start browser-native speech recognition (Web Speech API).
 * Falls back to AssemblyAI for browsers that don't support it.
 */
export function startListening(
  onResult: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  onEnd?: () => void
): () => void {
  // Try Web Speech API first (Chrome, Edge, Safari)
  const SpeechRecognitionAPI =
    (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
    (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

  if (SpeechRecognitionAPI) {
    recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (final) onResult(final, true);
      else if (interim) onResult(interim, false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      onError?.(event.error);
    };

    recognition.onend = () => {
      recognition = null;
      onEnd?.();
    };

    recognition.start();

    return () => {
      recognition?.stop();
      recognition = null;
    };
  }

  // Fallback: AssemblyAI real-time transcription via WebSocket
  if (!ASSEMBLYAI_API_KEY) {
    onError?.('Speech recognition not available. Add VITE_ASSEMBLYAI_API_KEY for fallback.');
    return () => {};
  }

  return startAssemblyAIListening(onResult, onError, onEnd);
}

export function stopListening(): void {
  recognition?.stop();
  recognition = null;
}

export function isListening(): boolean {
  return recognition !== null;
}

// ─── AssemblyAI WebSocket STT ─────────────────────────────────────────────────

function startAssemblyAIListening(
  onResult: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  onEnd?: () => void
): () => void {
  let ws: WebSocket | null = null;
  let mediaStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;

  (async () => {
    try {
      // Get temporary AssemblyAI token
      const tokenResp = await fetch('https://api.assemblyai.com/v2/realtime/token', {
        method: 'POST',
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ expires_in: 480 }),
      });

      if (!tokenResp.ok) throw new Error(`AssemblyAI token error: ${tokenResp.status}`);
      const { token } = await tokenResp.json();

      ws = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`);

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.message_type === 'PartialTranscript') {
          onResult(msg.text, false);
        } else if (msg.message_type === 'FinalTranscript') {
          onResult(msg.text, true);
        }
      };

      ws.onerror = () => onError?.('AssemblyAI WebSocket error');
      ws.onclose = () => onEnd?.();

      ws.onopen = async () => {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new AudioContext({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(mediaStream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          if (ws?.readyState !== WebSocket.OPEN) return;
          const pcm = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(pcm.length);
          for (let i = 0; i < pcm.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, pcm[i] * 32768));
          }
          ws.send(int16.buffer);
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
  })();

  return () => {
    processor?.disconnect();
    audioContext?.close();
    mediaStream?.getTracks().forEach(t => t.stop());
    ws?.close();
  };
}

// ─── Voice Availability Check ─────────────────────────────────────────────────

export function getVoiceState(): VoiceState {
  const hasSpeechRecognition = !!(
    (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
    (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );

  return {
    isSpeaking: isSpeaking(),
    isListening: isListening(),
    isAvailable: !!(ELEVENLABS_API_KEY || hasSpeechRecognition),
    ttsAvailable: !!ELEVENLABS_API_KEY,
    sttAvailable: hasSpeechRecognition || !!ASSEMBLYAI_API_KEY,
  };
}
