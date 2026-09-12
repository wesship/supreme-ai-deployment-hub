import { FormEvent, useEffect, useState } from 'react';
import { BrainCircuit, CheckCircle2, Link2, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://api.d3vonn.io').replace(/\/$/, '');
const clientKey = (import.meta.env.VITE_CLIENT_AI_CLIENT_KEY || 'default').trim().toLowerCase();
const brandName = (import.meta.env.VITE_CLIENT_AI_BRAND_NAME || 'Your AI').trim();

type Profile = {
  id: string;
  display_name?: string | null;
  profile_state: string;
  client_key: string;
};

type Source = {
  id: string;
  title?: string | null;
  source_type: string;
  source_uri?: string | null;
  ingestion_status: string;
};

async function authFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in before opening your Client AI workspace.');
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || 'Client AI request failed.');
  }
  return response.json();
}

export default function ClientAIWorkspace() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');
  const [sourceUri, setSourceUri] = useState('');
  const [sourceType, setSourceType] = useState('website');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refreshSources = async (profileId: string) => {
    const rows = await authFetch(`/api/client-ai/profiles/${profileId}/sources`);
    setSources(rows);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await authFetch(`/api/client-ai/profiles/me?client_key=${encodeURIComponent(clientKey)}`);
        if (!active) return;
        setProfile(current);
        setDisplayName(current.display_name || '');
        await refreshSources(current.id);
        setStatus('ready');
      } catch (error) {
        if (!active) return;
        setStatus('ready');
        setMessage(error instanceof Error ? error.message : 'Create your profile to begin.');
      }
    })();
    return () => { active = false; };
  }, []);

  const initialize = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const result = await authFetch('/api/client-ai/profiles/initialize', {
        method: 'POST',
        body: JSON.stringify({ client_key: clientKey, display_name: displayName || null }),
      });
      setProfile(result.profile);
      setMessage(result.created ? 'Workspace created. Add your first source.' : 'Workspace loaded.');
      await refreshSources(result.profile.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to initialize workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  const addSource = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    setMessage('');
    try {
      await authFetch(`/api/client-ai/profiles/${profile.id}/sources`, {
        method: 'POST',
        body: JSON.stringify({
          source_type: sourceType,
          title: title || null,
          source_uri: sourceUri || null,
          consent_confirmed: consent,
          metadata: { registered_from: 'client-ai-workspace' },
        }),
      });
      setTitle('');
      setSourceUri('');
      setConsent(false);
      setMessage('Source accepted. Hermes has queued ingestion.');
      await refreshSources(profile.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to register source.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return <div className="grid min-h-screen place-items-center bg-[#0a0d12] text-white"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0d12] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3"><BrainCircuit className="h-5 w-5" /><div><p className="font-semibold">{brandName}</p><p className="text-xs text-white/45">Hermes Client AI Workspace</p></div></div>
          {profile && <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/55">{profile.profile_state}</span>}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
            <div className="flex items-center gap-2 text-sm text-white/55"><ShieldCheck className="h-4 w-4" /> Private, ownership-scoped workspace</div>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em]">Train your AI on what you choose.</h1>
            <p className="mt-4 text-sm leading-6 text-white/50">Every source requires explicit confirmation before Hermes queues ingestion. Your browser never writes directly to the Client AI tables.</p>

            {!profile ? (
              <form onSubmit={initialize} className="mt-8 space-y-3">
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:border-white/30" />
                <button disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-medium text-black disabled:opacity-50">Create workspace {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</button>
              </form>
            ) : (
              <form onSubmit={addSource} className="mt-8 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="h-12 rounded-xl border border-white/10 bg-[#11151c] px-3">
                    <option value="website">Website</option><option value="document">Document</option><option value="voice">Voice</option><option value="video">Video</option><option value="social">Social</option><option value="note">Note</option>
                  </select>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Source title" className="h-12 rounded-xl border border-white/10 bg-black/20 px-4 outline-none" />
                </div>
                <div className="relative"><Link2 className="absolute left-4 top-4 h-4 w-4 text-white/30" /><input value={sourceUri} onChange={(e) => setSourceUri(e.target.value)} placeholder="https://… or approved storage URI" className="h-12 w-full rounded-xl border border-white/10 bg-black/20 pl-11 pr-4 outline-none" /></div>
                <label className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-5 text-white/60"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" /><span>I confirm I own or am authorized to use this source and I consent to its ingestion into this Client AI.</span></label>
                <button disabled={submitting || !consent} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-medium text-black disabled:opacity-40">Queue with Hermes {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</button>
              </form>
            )}
            {message && <p className="mt-5 text-sm text-white/60">{message}</p>}
          </section>

          <section>
            <div className="mb-5 flex items-end justify-between"><div><p className="text-xs uppercase tracking-[0.18em] text-white/35">Knowledge sources</p><h2 className="mt-2 text-2xl font-semibold">Training queue</h2></div><span className="text-sm text-white/35">{sources.length} sources</span></div>
            <div className="space-y-3">
              {sources.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/35">No sources yet. Add one when your workspace is ready.</div>}
              {sources.map((source) => (
                <div key={source.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <div><p className="font-medium">{source.title || source.source_uri || 'Untitled source'}</p><p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/35">{source.source_type}</p></div>
                  <div className="flex items-center gap-2 text-sm text-white/45"><CheckCircle2 className="h-4 w-4" /> {source.ingestion_status}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
