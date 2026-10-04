import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { checkHandoff, ownedHandoffProjects, saveHandoff, type HandoffProject, type HandoffResult } from './handoffService';
import type { WorkflowMetadata } from './workflowImport';

export default function AuthenticatedHandoff({ metadata }: { metadata: WorkflowMetadata }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<HandoffProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState<HandoffResult | null>(null);
  const epoch = useRef(0);
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    let alive = true; let events = 0;
    const reset = (id: string | null) => {
      if (!alive) return;
      ++epoch.current; requestId.current = crypto.randomUUID();
      setUserId(id); setProjects([]); setProjectId(''); setConnected(false); setBusy(false); setSaved(null); setMessage('');
    };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { ++events; reset(session?.user.id ?? null); });
    const initialEvents = events;
    void supabase.auth.getSession().then(({ data }) => { if (events === initialEvents) reset(data.session?.user.id ?? null); }).catch(() => reset(null));
    return () => { alive = false; ++epoch.current; data.subscription.unsubscribe(); };
  }, [metadata]);
  async function connect() {
    if (!userId) return;
    const version = ++epoch.current; setBusy(true); setMessage(''); setSaved(null); setConnected(false); setProjects([]); setProjectId('');
    try {
      const status = await checkHandoff(userId);
      if (version !== epoch.current) return;
      if (!status.handoff_enabled) throw new Error('Draft handoff is not enabled on the backend yet.');
      const result = await ownedHandoffProjects(userId);
      if (version !== epoch.current) return;
      setProjects(result.items); setConnected(true);
      setMessage(result.items.length ? `Connection checked. ${result.has_more ? 'Showing the newest 50 owned projects. ' : ''}Rendering remains blocked.` : 'Connection checked. Create an AI Film project before saving this draft.');
    } catch (error) { if (version === epoch.current) setMessage(error instanceof Error ? error.message : 'Connection unavailable.'); }
    finally { if (version === epoch.current) setBusy(false); }
  }
  async function save() {
    if (!userId || !projectId || !connected) return;
    const version = ++epoch.current; setBusy(true); setMessage('');
    try {
      const result = await saveHandoff(userId, projectId, metadata, requestId.current);
      if (version !== epoch.current) return;
      setSaved(result); setMessage('Draft saved in your AI Film project. Imported statuses remain unverified.');
    } catch (error) { if (version === epoch.current) setMessage(error instanceof Error ? error.message : 'Save unavailable.'); }
    finally { if (version === epoch.current) setBusy(false); }
  }
  return <div className="mt-5 border-t border-stone-700 pt-5">
    <h4 className="font-semibold">Save a D3VONN review draft</h4>
    <p className="my-3 text-sm leading-6 text-stone-400">Send only the displayed title, format and stage status claims to a project you own. Scripts, media, consent records and render-job IDs are excluded. The server saves a draft; it does not approve or render it.</p>
    {!userId ? <p className="text-sm text-stone-400">Sign in to D3VONN to check this connection. <Link to="/login" className="text-amber-100 underline">Sign in</Link></p> : <>
      <button type="button" disabled={busy} className="border border-stone-600 px-3 py-2 text-sm disabled:opacity-50" onClick={() => void connect()}>Check authenticated connection</button>
      {connected && projects.length > 0 && <div className="mt-4 space-y-3">
        <label htmlFor="avatar-handoff-project" className="block text-sm">Your AI Film project</label>
        <select id="avatar-handoff-project" value={projectId} disabled={busy || !!saved} className="block w-full max-w-lg border border-stone-600 bg-stone-950 px-3 py-2" onChange={e => { setProjectId(e.target.value); requestId.current = crypto.randomUUID(); }}>
          <option value="">Choose a project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <button type="button" disabled={busy || !projectId || !!saved} className="border border-amber-200 px-3 py-2 text-sm text-amber-100 disabled:opacity-50" onClick={() => void save()}>{busy ? 'Checking…' : 'Save metadata as draft'}</button>
      </div>}
    </>}
    {message && <p role="status" className="mt-3 text-sm text-amber-100">{message}</p>}
    {saved && <ul className="mt-3 space-y-2 text-sm text-stone-400">{saved.blockers.map(b => <li key={b}>{b}</li>)}</ul>}
  </div>;
}
