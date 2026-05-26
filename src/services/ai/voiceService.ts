/**
 * Devonn.ai Voice Service — Phase 4
 * Text-to-Speech: ElevenLabs (proxied through api.devonn.ai/api/tools/voice/tts)
 * Speech-to-Text: Web Speech API (primary) + AssemblyAI via proxy (fallback)
 *
 * Security: No API keys in the browser bundle.
 *   ELEVENLABS_API_KEY → server-side only (api.devonn.ai)
 *   ASSEMBLYAI_API_KEY → server-side only (api.devonn.ai)
 */

// Proxy base — all sensitive voice calls go through the backend
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.devonn.ai';

// Default ElevenLabs voice — "Rachel" (neutral, clear, professional)
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TTSOptions {
  voiceId?: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
  speed?: number;
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

// ─── TTS: ElevenLabs via server proxy ─────────────────────────────────────────

let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let ttsProxyAvailable: boolean | null = null; // cached availability check

/**
 * Convert text to speech via api.devonn.ai/api/tools/voice/tts (server holds the ElevenLabs key).
 * Returns a promise that resolves when audio finishes playing.
 */
export async function speak(text: string, options: TTSOptions = {}): Promise<void> {
  stopSpeaking();

  const voiceId = options.voiceId || DEFAULT_VOICE_ID;

  const response = await fetch(`${API_BASE}/api/tools/voice/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      model: options.model || 'eleven_turbo_v2_5',
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
        speed: options.speed ?? 1.0,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(`TTS proxy error ${response.status}: ${err}`);
  }

  // Mark proxy as available on first success
  ttsProxyAvailable = true;

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    currentAudioUrl = audioUrl;

    audio.onended = () => { cleanup(); resolve(); };
    audio.onerror = (e) => { cleanup(); reject(new Error(`Audio playback error: ${String(e)}`)); };
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

// ─── STT: Browser Web Speech API (primary) + AssemblyAI proxy (fallback) ──────

let recognition: SpeechRecognition | null = null;

/**
 * Start speech recognition.
 * Primary: Web Speech API (Chrome, Edge, Safari) — no keys needed.
 * Fallback: AssemblyAI via api.devonn.ai/api/tools/voice/stt-token (server holds the key).
 */
export function startListening(
  onResult: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  onEnd?: () => void
): () => void {
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
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      if (final) onResult(final, true);
      else if (interim) onResult(interim, false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => onError?.(event.error);
    recognition.onend = () => { recognition = null; onEnd?.(); };
    recognition.start();

    return () => { recognition?.stop(); recognition = null; };
  }

  // Fallback: AssemblyAI via server-side token proxy
  return startAssemblyAIListening(onResult, onError, onEnd);
}

export function stopListening(): void {
  recognition?.stop();
  recognition = null;
}

export function isListening(): boolean {
  return recognition !== null;
}

// ─── AssemblyAI WebSocket STT (via server-side token) ─────────────────────────

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
      // Get a short-lived AssemblyAI token from the server proxy
      // Server holds ASSEMBLYAI_API_KEY; client never sees it
      const tokenResp = await fetch(`${API_BASE}/api/tools/voice/stt-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_in: 480 }),
      });

      if (!tokenResp.ok) {
        throw new Error(`STT token proxy error: ${tokenResp.status}`);
      }

      const { token } = await tokenResp.json();

      ws = new WebSocket(
        `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
      );

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.message_type === 'PartialTranscript') onResult(msg.text, false);
        else if (msg.message_type === 'FinalTranscript') onResult(msg.text, true);
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
      onError?.(
        err instanceof Error
          ? `${err.message} — ensure api.devonn.ai is running with ASSEMBLYAI_API_KEY`
          : String(err)
      );
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
    // Available if browser STT works (no key needed) OR TTS proxy has responded successfully
    isAvailable: hasSpeechRecognition || ttsProxyAvailable === true,
    ttsAvailable: true, // proxy always attempted; failure shown at speak() time
    sttAvailable: hasSpeechRecognition || true, // proxy fallback always available
  };
}
