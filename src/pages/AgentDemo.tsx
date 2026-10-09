import React, { useState } from 'react';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const PREVIEW_ENABLED = import.meta.env.VITE_PUBLIC_AI_DEMO_ENABLED === 'true';

const AgentDemo = () => {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!PREVIEW_ENABLED || !API_BASE || busy || !prompt.trim()) return;
    setBusy(true);
    setError('');
    setAnswer('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_BASE}/api/public/agent-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: controller.signal,
      });
      if (response.status === 429) throw new Error('Demo limit reached. Please try later.');
      if (!response.ok) throw new Error('The public demo is currently unavailable.');
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('answer' in data) || typeof data.answer !== 'string') {
        throw new Error('The demo returned an invalid response.');
      }
      setAnswer(data.answer);
    } catch (err) {
      setError(err instanceof Error && err.name === 'AbortError'
        ? 'The demo timed out. Please try again.'
        : err instanceof Error ? err.message : 'Demo unavailable.');
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };

  return (
    <section className="container mx-auto px-5 py-8 text-white">
      <D3vonnPageBanner title="Agent Preview" />
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-black/40 p-6">
        <h1 className="text-3xl font-bold">Try the D3VONN.IO public AI preview</h1>
        <p className="mt-3 text-white/80">
          A restricted, general-purpose AI demonstration. No personal workspace, Hermes tools, or private data is connected.
          Do not enter sensitive information.
        </p>
        {!PREVIEW_ENABLED || !API_BASE ? (
          <p role="status" className="mt-6 rounded-lg border border-amber-200/30 p-4">
            Live AI preview is not available yet. Explore the agent workflow on the homepage.
            {' '}<a className="underline" href="/#agents">View workflow preview</a>
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label htmlFor="public-demo-prompt" className="block font-semibold">Your question (500 characters maximum)</label>
            <textarea id="public-demo-prompt" value={prompt} maxLength={500} rows={4}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full rounded-lg border border-white/30 bg-black/50 p-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              placeholder="Ask a general question about AI workflows" />
            <button type="submit" disabled={busy || !prompt.trim()} className="min-h-12 rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white disabled:opacity-50">
              {busy ? 'Generating response…' : 'Ask AI'}
            </button>
          </form>
        )}
        {error && <p role="alert" className="mt-5 text-amber-200">{error}</p>}
        {answer && <div role="status" aria-live="polite" className="mt-6 rounded-xl border border-white/20 bg-white/5 p-4">
          <h2 className="font-bold">AI response</h2><p className="mt-2 whitespace-pre-wrap">{answer}</p>
        </div>}
      </div>
    </section>
  );
};

export default AgentDemo;
