import { useEffect, useMemo, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

type Status = 'offline' | 'online' | 'connecting';

type GlassEvent = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  source: { adapter: string; device_id: string; session_id: string };
  correlation_id: string;
  privacy: { classification: 'user_private' | 'sensitive' | 'restricted'; consent: boolean };
  payload: Record<string, unknown>;
  capabilities: string[];
  audit: { policy_version: string; trace_id: string };
};

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function sendEvent(event: GlassEvent) {
  if (!API_BASE) return false;
  const response = await fetch(`${API_BASE}/api/v1/vision/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error(`Wearable API returned ${response.status}`);
  return true;
}

export default function D3VONNGlasses() {
  const [status, setStatus] = useState<Status>('connecting');
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState('D3VONN ready');
  const [nowPlaying, setNowPlaying] = useState('HNF Radio');

  const actions = useMemo(() => [
    { label: 'ASK', detail: 'Ask D3VONN' },
    { label: 'PLAY', detail: nowPlaying },
    { label: 'NEXT', detail: 'Next PRIMETIME' },
    { label: 'ALERT', detail: 'Notifications' },
  ], [nowPlaying]);

  useEffect(() => {
    const timer = window.setTimeout(() => setStatus(API_BASE ? 'online' : 'offline'), 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') setSelected((value) => (value + 1) % actions.length);
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') setSelected((value) => (value - 1 + actions.length) % actions.length);
      if (event.key === 'Enter') void activate(actions[selected].label);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function activate(action: string) {
    setMessage(action === 'ASK' ? 'Listening…' : action === 'PLAY' ? 'HNF Radio' : action === 'NEXT' ? 'PRIMETIME queued' : 'No new alerts');
    if (action !== 'ASK') return;
    try {
      await sendEvent({
        event_id: id('glass'),
        event_type: 'audio.command',
        occurred_at: new Date().toISOString(),
        source: { adapter: 'meta-display-webapp', device_id: 'display-webapp', session_id: id('session') },
        correlation_id: id('corr'),
        privacy: { classification: 'user_private', consent: true },
        payload: { command: 'ask_d3vonn' },
        capabilities: ['microphone', 'speaker'],
        audit: { policy_version: 'wearable-v1', trace_id: id('trace') },
      });
    } catch {
      setMessage('API unavailable — local mode');
      setStatus('offline');
    }
  }

  return (
    <main className="min-h-screen bg-black p-8 font-sans text-white" aria-label="D3VONN Ray-Ban Display application">
      <section className="mx-auto flex min-h-[600px] w-full max-w-[600px] flex-col justify-between border border-white/10 bg-black p-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-black tracking-[0.18em]">D3VONN</p>
            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/50">Wearable OS</p>
          </div>
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-widest" aria-live="polite">
            {status}
          </span>
        </header>

        <div className="py-8" aria-live="polite">
          <p className="text-xs uppercase tracking-[0.25em] text-white/45">Current</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{message}</h1>
          <p className="mt-4 text-sm text-white/55">PRIMETIME · HNF Radio</p>
        </div>

        <nav aria-label="Glasses actions" className="grid gap-3">
          {actions.map((action, index) => (
            <button
              key={action.label}
              type="button"
              onClick={() => { setSelected(index); void activate(action.label); }}
              className={`flex items-center justify-between border px-5 py-4 text-left transition ${selected === index ? 'border-white bg-white text-black' : 'border-white/15 bg-white/[0.03] text-white'}`}
              aria-current={selected === index ? 'true' : undefined}
            >
              <span className="text-xs font-black tracking-[0.2em]">{action.label}</span>
              <span className="text-sm">{action.detail}</span>
            </button>
          ))}
        </nav>

        <footer className="pt-6 text-center text-[10px] uppercase tracking-[0.2em] text-white/35">
          D-pad / Neural Band ready · Consent-gated · No privileged secrets
        </footer>
      </section>
    </main>
  );
}
