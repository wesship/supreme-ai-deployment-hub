/**
 * D3VONN.IO voice service.
 * TTS: ElevenLabs/OpenAI through the authenticated backend proxy.
 * STT: Web Speech API with authenticated AssemblyAI v3 fallback.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.d3vonn.io';
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

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

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type AssemblyAITurnMessage = {
  type?: string;
  transcript?: string;
  end_of_turn?: boolean;
  turn_is_formatted?: boolean;
  error?: string;
};

let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let recognition: SpeechRecognitionInstance | null = null;
let fallbackStop: (() => void) | null = null;

async function getAuthenticatedHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your session has expired. Sign in again to use voice services.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function speak(text: string, options: TTSOptions = {}): Promise<void> {
  stopSpeaking();
  const headers = await getAuthenticatedHeaders();
  const response = await fetch(`${API_BASE}/api/tools/voice/tts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      voice_id: options.voiceId || DEFAULT_VOICE_ID,
      model: options.model || 'eleven_turbo_v2_5',
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
        speed: options.speed ?? 1,
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(`Voice playback failed (${response.status}): ${detail}`);
  }
  const audioBlob = await response.blob();
  if (!audioBlob.size) throw new Error('The voice service returned empty audio.');
  const audioUrl = URL.createObjectURL(audioBlob);
  currentAudioUrl = audioUrl;
  await new Promise<void>((resolve, reject) => {
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    audio.onended = () => { cleanupAudio(); resolve(); };
    audio.onerror = () => { cleanupAudio(); reject(new Error('The browser could not play the generated audio.')); };
    audio.play().catch((error) => {
      cleanupAudio();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

function cleanupAudio(): void {
  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  currentAudioUrl = null;
  currentAudio = null;
}

export function stopSpeaking(): void {
  if (!currentAudio) return;
  currentAudio.pause();
  currentAudio.currentTime = 0;
  cleanupAudio();
}

export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

export function startListening(
  onResult: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  onEnd?: () => void,
): () => void {
  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (SpeechRecognitionAPI) {
    try {
      recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += transcript;
          else interim += transcript;
        }
        if (final) onResult(final, true);
        else if (interim) onResult(interim, false);
      };
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        recognition = null;
        onError?.(formatSpeechError(event.error));
      };
      recognition.onend = () => { recognition = null; onEnd?.(); };
      recognition.start();
      return () => { recognition?.stop(); recognition = null; };
    } catch (error) {
      recognition = null;
      console.warn('[voiceService] Browser speech recognition failed; using AssemblyAI fallback.', error);
    }
  }
  fallbackStop = startAssemblyAIListening(onResult, onError, onEnd);
  return () => { fallbackStop?.(); fallbackStop = null; };
}

export function stopListening(): void {
  recognition?.stop();
  recognition = null;
  fallbackStop?.();
  fallbackStop = null;
}

export function isListening(): boolean {
  return recognition !== null || fallbackStop !== null;
}

function formatSpeechError(error: string): string {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Microphone access was denied. Allow microphone permission for d3vonn.io and try again.';
  }
  if (error === 'audio-capture') return 'No working microphone was detected.';
  if (error === 'no-speech') return 'No speech was detected. Try again and speak clearly.';
  if (error === 'network') return 'Browser speech recognition had a network error.';
  return `Speech recognition error: ${error}`;
}

function startAssemblyAIListening(
  onResult: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  onEnd?: () => void,
): () => void {
  let ws: WebSocket | null = null;
  let mediaStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let stopped = false;
  let ended = false;

  const finish = () => {
    if (ended) return;
    ended = true;
    fallbackStop = null;
    onEnd?.();
  };
  const cleanup = () => {
    processor?.disconnect();
    processor = null;
    void audioContext?.close();
    audioContext = null;
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    if (ws && ws.readyState < WebSocket.CLOSING) ws.close();
    ws = null;
  };

  void (async () => {
    try {
      const headers = await getAuthenticatedHeaders();
      const tokenResp = await fetch(`${API_BASE}/api/tools/voice/stt-token`, {
        method: 'POST', headers, body: JSON.stringify({ expires_in: 480 }),
      });
      if (!tokenResp.ok) {
        const detail = await tokenResp.text().catch(() => '');
        throw new Error(`Speech service unavailable (${tokenResp.status})${detail ? `: ${detail}` : ''}`);
      }
      const { token } = (await tokenResp.json()) as { token?: string };
      if (!token) throw new Error('The speech service returned no temporary token.');
      if (stopped) return;

      ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&token=${encodeURIComponent(token)}`);
      ws.binaryType = 'arraybuffer';
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as AssemblyAITurnMessage;
          if (message.type === 'Error') {
            onError?.(message.error || 'The speech transcription service returned an error.');
            return;
          }
          if (message.type !== 'Turn' || !message.transcript) return;
          onResult(message.transcript, Boolean(message.end_of_turn || message.turn_is_formatted));
        } catch (error) {
          console.warn('[voiceService] Ignored malformed AssemblyAI message.', error);
        }
      };
      ws.onerror = () => onError?.('The speech transcription connection failed.');
      ws.onclose = () => { cleanup(); finish(); };
      ws.onopen = async () => {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioContext = new AudioContext({ sampleRate: 16000 });
          const source = audioContext.createMediaStreamSource(mediaStream);
          processor = audioContext.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (event) => {
            if (ws?.readyState !== WebSocket.OPEN) return;
            const pcm = event.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(pcm.length);
            for (let i = 0; i < pcm.length; i += 1) {
              int16[i] = Math.max(-32768, Math.min(32767, pcm[i] * 32768));
            }
            ws.send(int16.buffer);
          };
          source.connect(processor);
          processor.connect(audioContext.destination);
        } catch (error) {
          cleanup();
          onError?.(error instanceof Error ? error.message : String(error));
          finish();
        }
      };
    } catch (error) {
      cleanup();
      onError?.(error instanceof Error ? error.message : String(error));
      finish();
    }
  })();

  return () => {
    stopped = true;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'Terminate' }));
    }
    cleanup();
    finish();
  };
}

export function getVoiceState(): VoiceState {
  const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  return {
    isSpeaking: isSpeaking(),
    isListening: isListening(),
    isAvailable: true,
    ttsAvailable: true,
    sttAvailable: hasMediaDevices,
  };
}
