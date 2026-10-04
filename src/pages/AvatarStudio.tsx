import WorkflowImport from '@/features/avatar-studio/WorkflowImport';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import PublicPageShell from '@/components/shell/PublicPageShell';
import { ACADEMY_PREVIEW, avatarUseCases, buildAvatarWorkflowBrief, studioLaunchUrl, type AvatarTemplate } from '@/features/avatar-studio/catalog';

function downloadBrief(template: AvatarTemplate) {
  const blob = new Blob([JSON.stringify(buildAvatarWorkflowBrief(template), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${template}-workflow-brief.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function AvatarStudio() {
  return <PublicPageShell breadcrumbs={[{ label: 'Avatar Studio' }]}>
    <Helmet><title>Avatar Studio workflows — D3VONN.IO</title><meta name="description" content="Create reviewed avatar workflows for podcasts, interviews, films and HNF Academy lessons." /><link rel="canonical" href="https://d3vonn.io/avatar-studio" /></Helmet>
    <main className="min-h-screen bg-stone-950 px-4 py-12 text-stone-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-200">D3VONN.IO · Use cases and workflows</p>
        <h1 className="mt-4 text-4xl font-bold sm:text-5xl">One character. News, teaching and creative production.</h1>
        <p className="mt-5 max-w-3xl leading-7 text-stone-400">Prepare characters, scripts, virtual sets and lessons in Avatar Studio. Review teaching packages in HNF Academy. Bring approved plans into your D3VONN workflow.</p>
        <div className="mt-6 flex flex-wrap gap-3"><a href={studioLaunchUrl()} target="_blank" rel="noopener noreferrer" className="bg-amber-200 px-5 py-3 font-semibold text-stone-950">Open Studio preview ↗</a><Link to="/workflows" className="border border-stone-600 px-5 py-3">D3VONN workflows</Link><Link to="/ai-films" className="border border-stone-600 px-5 py-3">AI Films</Link></div>
        <p className="mt-4 text-sm text-stone-400">External previews use separate sessions. Opening a template sends only its template name.</p>
        <section className="mt-10 grid gap-4 md:grid-cols-2" aria-label="Avatar use cases">
          {avatarUseCases.map(item => <article key={item.id} className="border border-stone-700 bg-stone-900 p-6">
            <h2 className="text-xl font-semibold">{item.title}</h2><p className="mt-3 leading-6 text-stone-400">{item.description}</p>
            <ol className="my-5 list-inside list-decimal space-y-2 text-sm text-stone-300">{item.steps.map(step => <li key={step}>{step}</li>)}</ol>
            <p className="mb-4 text-sm text-amber-100">Output: {item.outcome}</p>
            <div className="flex flex-wrap gap-3"><a href={studioLaunchUrl(item.id)} target="_blank" rel="noopener noreferrer" className="border border-amber-200 px-3 py-2 text-sm text-amber-100">Prepare in Studio ↗</a><button type="button" onClick={() => downloadBrief(item.id)} className="border border-stone-600 px-3 py-2 text-sm">Download workflow brief</button></div>
          </article>)}
        </section>
        <WorkflowImport />
        <section className="mt-8 border border-stone-700 p-6" aria-labelledby="academy-bridge"><h2 id="academy-bridge" className="text-xl font-semibold">Studio → HNF Academy</h2><p className="mt-3 leading-6 text-stone-400">Export a lesson package from Studio, open Academy’s lesson review page, and select the JSON file. Review objectives, sections and practice before saving a local teaching draft. This file handoff does not publish a course or transfer learner records.</p><a className="mt-4 inline-block text-amber-100 underline" href={ACADEMY_PREVIEW} target="_blank" rel="noopener noreferrer">Open Academy lesson review preview ↗</a></section>
        <section className="mt-8 border border-stone-700 p-6" aria-labelledby="connection-status"><h2 id="connection-status" className="text-xl font-semibold">Connection status</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="font-semibold">Available</dt><dd className="mt-1 text-sm leading-6 text-stone-400">Use-case launch links and downloadable draft workflow briefs. Local Studio authoring and Academy lesson review run in their respective previews.</dd></div><div><dt className="font-semibold">Requires configuration</dt><dd className="mt-1 text-sm leading-6 text-stone-400">MuseTalk rendering workers, authenticated Hermes execution, OpenAvatarChat live sessions, cross-app sign-in and LMS publishing. NVIDIA enhancements require a verified worker capability report; DLSS 5 remains unverified.</dd></div></dl><p className="mt-4 text-sm text-stone-400">A workflow brief is a planning document, not an executable Hermes workflow.</p></section>
      </div>
    </main>
  </PublicPageShell>;
}
