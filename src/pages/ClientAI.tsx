import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, BrainCircuit, FileText, Mic2, Share2, Sparkles, Upload, WandSparkles } from 'lucide-react';

const clientKey = (import.meta.env.VITE_CLIENT_AI_CLIENT_KEY || 'default').trim();
const funnelKey = (import.meta.env.VITE_CLIENT_AI_FUNNEL_KEY || 'create1').trim();
const brandName = (import.meta.env.VITE_CLIENT_AI_BRAND_NAME || 'Your AI').trim();
const accentCopy = (import.meta.env.VITE_CLIENT_AI_TAGLINE || 'Built from your voice, knowledge, and point of view.').trim();
const apiBase = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://api.d3vonn.io' : 'http://localhost:8000')).replace(/\/$/, '');

const steps = [
  {
    number: '01',
    title: 'Capture',
    body: 'Bring in your voice, documents, notes, links, and lived expertise. Hermes organizes each source into a consent-aware personal knowledge layer.',
    items: ['Record voice', 'Upload documents', 'Add notes', 'Connect sources'],
    icon: Mic2,
  },
  {
    number: '02',
    title: 'Create',
    body: 'Turn what you know into usable output: answers, drafts, documents, content, workflows, and repeatable skills that stay grounded in your material.',
    items: ['Draft content', 'Generate documents', 'Build skills', 'Automate workflows'],
    icon: WandSparkles,
  },
  {
    number: '03',
    title: 'Share & Grow',
    body: 'Publish a controlled client-facing AI, collect subscribers or leads, and route every important interaction back through Hermes for qualification and follow-up.',
    items: ['Share anywhere', 'Capture leads', 'Serve clients', 'Grow revenue'],
    icon: Share2,
  },
];

async function submitLead(email: string) {
  const response = await fetch(`${apiBase}/api/client-ai/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email,
      client_key: clientKey,
      funnel_key: funnelKey,
      source: 'client-ai-landing',
      consent_to_contact: true,
      website: '',
    }),
  });

  if (!response.ok) {
    throw new Error('We could not start your workspace. Please try again.');
  }
  return response.json();
}

export default function ClientAI() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const normalizedBrand = useMemo(() => brandName || 'Your AI', []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    setStatus('sending');
    setMessage('');
    try {
      await submitLead(value);
      setStatus('success');
      setMessage('You’re in. Hermes is preparing the next onboarding step.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to continue right now.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f1ea] text-[#11110f] selection:bg-black selection:text-white">
      <header className="border-b border-black/10 bg-[#f5f1ea]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full border border-black/15 bg-white/50">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">{normalizedBrand}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Powered by Hermes</p>
            </div>
          </div>
          <a href="#start" className="hidden rounded-full border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black hover:text-white sm:inline-flex">
            Start your AI
          </a>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-black/10">
          <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_1px_1px,rgba(17,17,15,0.1)_1px,transparent_0)] [background-size:24px_24px]" />
          <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-24 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-32">
            <div className="max-w-4xl">
              <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-black/60">
                <BrainCircuit className="h-3.5 w-3.5" /> Individual intelligence, orchestrated
              </p>
              <h1 className="max-w-4xl text-6xl font-semibold leading-[0.92] tracking-[-0.055em] sm:text-7xl lg:text-[6.6rem]">
                Your knowledge.<br />Your voice.<br />Your AI.
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-black/60 sm:text-xl">{accentCopy}</p>
            </div>

            <div id="start" className="self-end rounded-[2rem] border border-black/10 bg-white/65 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.08)] backdrop-blur sm:p-8">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Start here</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Create your workspace</h2>
              <p className="mt-3 text-sm leading-6 text-black/55">Enter your email and Hermes will open the onboarding path for this client AI.</p>
              <form onSubmit={handleSubmit} className="mt-7 space-y-3">
                <label htmlFor="client-ai-email" className="sr-only">Email address</label>
                <input
                  id="client-ai-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-14 w-full rounded-2xl border border-black/10 bg-[#faf8f4] px-4 text-base outline-none transition placeholder:text-black/30 focus:border-black/40"
                />
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-black px-5 font-medium text-white transition hover:translate-y-[-1px] disabled:cursor-wait disabled:opacity-60"
                >
                  {status === 'sending' ? 'Preparing…' : 'Start with Hermes'} <ArrowRight className="h-4 w-4" />
                </button>
              </form>
              {message && (
                <p role="status" className={`mt-4 text-sm ${status === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{message}</p>
              )}
              <p className="mt-5 text-xs leading-5 text-black/40">By continuing, you agree that this client may contact you about your AI workspace. Sensitive source data is not submitted through this form.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">How it works</p>
            <h2 className="mt-4 text-5xl font-semibold tracking-[-0.045em] sm:text-6xl">Capture. Create. Share.</h2>
            <p className="mt-5 text-lg leading-8 text-black/55">A client-owned intelligence layer in three clear stages, with Hermes coordinating the work behind each one.</p>
          </div>

          <div className="mt-16 divide-y divide-black/10 border-y border-black/10">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.number} className="grid gap-8 py-12 lg:grid-cols-[120px_1fr_1fr] lg:gap-12 lg:py-16">
                  <div className="flex items-start gap-3 lg:block">
                    <span className="text-sm font-medium text-black/35">STEP {step.number}</span>
                    <div className="mt-0 grid h-10 w-10 place-items-center rounded-full border border-black/10 lg:mt-6">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-4xl font-semibold tracking-[-0.04em]">{step.title}</h3>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-black/55">{step.body}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 self-start">
                    {step.items.map((item) => (
                      <div key={item} className="rounded-2xl border border-black/10 bg-white/40 px-4 py-4 text-sm font-medium">{item}</div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-t border-black/10 bg-[#11110f] text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:px-10 lg:py-24">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">Hermes advantage</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">This is more than a chatbot.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 p-5"><Upload className="h-5 w-5" /><p className="mt-5 font-medium">Grounded sources</p><p className="mt-2 text-sm leading-6 text-white/45">Voice, files, notes, and connected knowledge.</p></div>
              <div className="rounded-2xl border border-white/10 p-5"><BrainCircuit className="h-5 w-5" /><p className="mt-5 font-medium">Agent orchestration</p><p className="mt-2 text-sm leading-6 text-white/45">Hermes turns intent into tracked tasks and workflows.</p></div>
              <div className="rounded-2xl border border-white/10 p-5"><FileText className="h-5 w-5" /><p className="mt-5 font-medium">Reusable expertise</p><p className="mt-2 text-sm leading-6 text-white/45">Package repeatable methods into governed skills.</p></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
