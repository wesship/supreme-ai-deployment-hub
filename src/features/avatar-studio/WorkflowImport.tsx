import { useRef, useState } from 'react';
import { parseWorkflowMetadata, type WorkflowMetadata } from './workflowImport';
import AuthenticatedHandoff from './AuthenticatedHandoff';
export default function WorkflowImport() {
  const [metadata, setMetadata] = useState<WorkflowMetadata | null>(null);
  const [error, setError] = useState('');
  const request = useRef(0);
  async function read(file?: File) {
    const version = ++request.current;
    setMetadata(null); setError('');
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith('.json') || file.size > 2 * 1024 * 1024) throw new Error('Select a JSON workflow file up to 2 MB.');
      const result = parseWorkflowMetadata(await file.text());
      if (version === request.current) setMetadata(result);
    } catch { if (version === request.current) setError('File rejected. Use a valid version-1 Studio workflow manifest, up to 2 MB.'); }
  }
  return <section className="mt-8 border border-stone-700 p-6" aria-labelledby="workflow-review">
    <h2 id="workflow-review" className="text-xl font-semibold">Review a Studio workflow manifest</h2>
    <p className="my-3 text-sm leading-6 text-stone-400">Choose the D3VONN workflow JSON exported from Studio. Only metadata is kept in page memory. Content and render-job IDs are discarded. Imported statuses are file claims; this does not run Hermes or verify a render.</p>
    <label htmlFor="studio-workflow-json" className="mb-2 block text-sm">Workflow JSON (max 2 MB)</label>
    <input id="studio-workflow-json" type="file" accept=".json,application/json" className="max-w-full text-sm" onChange={e => { void read(e.target.files?.[0]); e.target.value = ''; }} />
    {error && <p className="mt-3 text-amber-200" role="alert">{error}</p>}
    {metadata && <div className="mt-5 space-y-3 break-words"><h3 className="font-semibold">{metadata.project.title}</h3><p className="text-sm text-stone-400">Imported state: {metadata.overall} · unverified</p><ul className="space-y-3">{metadata.stages.map(stage => <li key={stage.stage} className="border-t border-stone-700 pt-3"><p>{stage.stage}: {stage.status}</p>{stage.blockers.map((blocker, i) => <p key={i} className="mt-1 text-sm text-stone-400">{blocker}</p>)}</li>)}</ul><button type="button" className="border border-stone-600 px-3 py-2 text-sm" onClick={() => { ++request.current; setMetadata(null); }}>Clear imported plan</button></div>}
    {metadata && <AuthenticatedHandoff metadata={metadata} />}
  </section>;
}
