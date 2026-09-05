import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2, Pause, Play, Square, Volume2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://api.d3vonn.io').replace(/\/$/, '');
const MAX_CHUNK = 4400;
const READABLE_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,td,th';
const SKIP_SELECTOR = [
  '[data-voice-skip]',
  'nav',
  'aside',
  'button',
  'input',
  'textarea',
  'select',
  'script',
  'style',
  'svg',
  '[aria-hidden="true"]',
].join(',');

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function extractReadablePageText(root: HTMLElement): string {
  const seen = new Set<string>();
  const blocks: string[] = [];

  root.querySelectorAll<HTMLElement>(READABLE_SELECTOR).forEach((element) => {
    if (element.closest(SKIP_SELECTOR)) return;
    const text = normalizeText(element.innerText || element.textContent || '');
    if (!text || text.length < 2 || seen.has(text)) return;
    seen.add(text);
    blocks.push(text);
  });

  return blocks.join('\n');
}

export function chunkReadableText(text: string, maxLength = MAX_CHUNK): string[] {
  const paragraphs = text.split(/\n+/).map(normalizeText).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current) chunks.push(current);
    current = '';
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxLength) {
      const candidate = current ? `${current}\n${paragraph}` : paragraph;
      if (candidate.length <= maxLength) {
        current = candidate;
      } else {
        pushCurrent();
        current = paragraph;
      }
      continue;
    }

    pushCurrent();
    const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [paragraph];
    let sentenceChunk = '';
    for (const sentence of sentences.map(normalizeText).filter(Boolean)) {
      if (sentence.length > maxLength) {
        if (sentenceChunk) {
          chunks.push(sentenceChunk);
          sentenceChunk = '';
        }
        for (let i = 0; i < sentence.length; i += maxLength) {
          chunks.push(sentence.slice(i, i + maxLength));
        }
        continue;
      }
      const candidate = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
      if (candidate.length <= maxLength) sentenceChunk = candidate;
      else {
        chunks.push(sentenceChunk);
        sentenceChunk = sentence;
      }
    }
    if (sentenceChunk) chunks.push(sentenceChunk);
  }

  pushCurrent();
  return chunks;
}

export default function PageVoiceReader() {
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const stoppedRef = useRef(false);
  const chunksRef = useRef<string[]>([]);
  const indexRef = useRef(0);

  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  const [message, setMessage] = useState('Read this page');

  const cleanupAudio = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    audioRef.current = null;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  };

  const stop = () => {
    stoppedRef.current = true;
    cleanupAudio();
    chunksRef.current = [];
    indexRef.current = 0;
    setState('idle');
    setMessage('Read this page');
  };

  useEffect(() => {
    stop();
    // stop playback whenever navigation changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  useEffect(() => () => cleanupAudio(), []);

  const synthesizeAndPlay = async (index: number) => {
    if (stoppedRef.current || index >= chunksRef.current.length) {
      stop();
      return;
    }

    setState('loading');
    setMessage(`Preparing voice ${index + 1} of ${chunksRef.current.length}`);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setState('error');
      setMessage('Sign in to use ElevenLabs page reading');
      return;
    }

    const response = await fetch(`${API_BASE}/api/tools/voice/tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: chunksRef.current[index],
        voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.0 },
      }),
    });

    if (!response.ok) {
      setState('error');
      setMessage(response.status === 429 ? 'Voice limit reached. Try again shortly.' : 'Page voice is unavailable');
      return;
    }

    cleanupAudio();
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    objectUrlRef.current = objectUrl;
    const audio = new Audio(objectUrl);
    audioRef.current = audio;

    audio.onplay = () => {
      setState('playing');
      setMessage(`Reading ${index + 1} of ${chunksRef.current.length}`);
    };
    audio.onpause = () => {
      if (!audio.ended && !stoppedRef.current) {
        setState('paused');
        setMessage('Paused');
      }
    };
    audio.onended = () => {
      indexRef.current = index + 1;
      void synthesizeAndPlay(index + 1);
    };
    audio.onerror = () => {
      setState('error');
      setMessage('Audio playback failed');
    };

    await audio.play();
  };

  const startReading = async () => {
    stoppedRef.current = false;
    const root = document.getElementById('main-content');
    if (!root) {
      setState('error');
      setMessage('No page content found');
      return;
    }

    const chunks = chunkReadableText(extractReadablePageText(root));
    if (!chunks.length) {
      setState('error');
      setMessage('No readable text on this page');
      return;
    }

    chunksRef.current = chunks;
    indexRef.current = 0;
    await synthesizeAndPlay(0);
  };

  const togglePause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  };

  const active = state === 'playing' || state === 'paused' || state === 'loading';

  return (
    <div
      data-voice-skip
      className="fixed bottom-5 left-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-white/10 bg-black/85 p-2 text-white shadow-2xl backdrop-blur-xl"
      role="group"
      aria-label="Page voice reader"
    >
      {!active ? (
        <button
          type="button"
          onClick={() => void startReading()}
          className="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="Read this page aloud with ElevenLabs"
        >
          <Volume2 className="h-4 w-4" aria-hidden="true" />
          <span className="max-w-44 truncate">{message}</span>
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void togglePause()}
            disabled={state === 'loading'}
            className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label={state === 'paused' ? 'Resume page reading' : 'Pause page reading'}
          >
            {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : state === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <span className="max-w-48 truncate px-1 text-xs text-white/75" aria-live="polite">{message}</span>
          <button
            type="button"
            onClick={stop}
            className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Stop page reading"
          >
            <Square className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
