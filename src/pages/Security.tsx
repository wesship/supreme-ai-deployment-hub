import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, FileCheck, KeyRound, MonitorCheck, Server, ArrowRight, Activity, Eye } from 'lucide-react';
import PublicPageShell from '@/components/shell/PublicPageShell';

const controls = [
  { icon: ShieldCheck, title: 'Defense-in-depth posture', body: 'Security headers, HTTPS-only delivery, protected app routes, and strict server-side API boundaries.' },
  { icon: Lock, title: 'Private data boundary', body: 'Sensitive AI, RAG, and tool calls are routed through backend services instead of exposing provider keys in the browser.' },
  { icon: KeyRound, title: 'Identity-ready architecture', body: 'Built for authenticated workspaces, role separation, administrator access, and future SSO/RBAC expansion.' },
  { icon: FileCheck, title: 'Auditability', body: 'Agent runs, task states, approvals, and operational checkpoints are designed to produce accountable execution trails.' },
  { icon: MonitorCheck, title: 'Observability', body: 'Health endpoints, command-center telemetry, deployment checks, and runtime status views support production operations.' },
  { icon: Server, title: 'Deployment flexibility', body: 'Cloud-first today with a product path toward private, VPC, and sovereign deployment models for enterprise buyers.' },
];

const readiness = [
  'Publish public security policy and responsible disclosure channel',
  'Add enterprise audit log export and retention controls',
  'Complete SOC 2 readiness mapping before regulated pilots',
  'Document SSO, RBAC, SCIM, data retention, and incident-response roadmap',
];

const breadcrumbs = [{ label: 'Enterprise' }, { label: 'Security & Trust' }];

const Security: React.FC = () => {
  const title = 'Enterprise Security & Trust — D3VONN.IO';
  const description = 'D3VONN.IO enterprise security and trust center for protected AI workforce orchestration, private data boundaries, observability, and auditability.';

  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://d3vonn.io/security" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://d3vonn.io/security" />
      </Helmet>

      <section className="d3-os-shell min-h-screen text-white" aria-labelledby="enterprise-trust-heading">
        <div className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
          <section className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-950/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-blue-300">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Enterprise Trust Center
            </div>
            <h1 id="enterprise-trust-heading" className="mt-8 text-4xl font-black tracking-tight sm:text-6xl">
              Enterprise trust for an <span className="text-blue-400">AI workforce</span>.
            </h1>
            <p className="mt-6 text-lg text-white/70">
              D3VONN.IO is being built around control, visibility, private execution boundaries, and accountable agent orchestration.
            </p>
            <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 text-left sm:grid-cols-4" aria-label="Enterprise trust signals">
              {[
                ['Encryption', 'Protected'],
                ['Identity', 'Auth ready'],
                ['Auditability', 'Visible'],
                ['Integrity', 'Monitored'],
              ].map(([label, value]) => (
                <div key={label} className="d3-chrome-panel rounded-xl p-3">
                  <div className="text-sm font-semibold text-blue-100">{value}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/45">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Link to="/contact?inquiry=security-review" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-[0_0_30px_rgba(56,136,255,0.35)] hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                Request security review <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/status" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                View system status
              </Link>
            </div>
          </section>

          <section className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-3xl border border-blue-500/20 bg-blue-950/10" aria-label="Governed AI operations illustration">
            <img
              src="/illustrations/governed-operations.svg"
              alt="Governed AI operations: agent proposals pass a human approval checkpoint with fail-closed policy before governed execution"
              className="h-auto w-full"
              loading="lazy"
            />
          </section>

          <section className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Enterprise security controls">
            {controls.map((item) => (
              <article key={item.title} className="d3-chrome-panel d3-command-surface rounded-2xl p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-950/50 text-blue-300">
                  <item.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="mt-5 text-xl font-bold">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
              </article>
            ))}
          </section>

          <section className="d3-chrome-panel mt-20 grid gap-8 rounded-3xl p-6 sm:p-8 lg:grid-cols-[0.85fr_1.15fr]" aria-labelledby="enterprise-roadmap-heading">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Enterprise roadmap</p>
              <h2 id="enterprise-roadmap-heading" className="mt-4 text-3xl font-black">What comes next for compliance readiness</h2>
              <p className="mt-4 text-white/65">
                The platform already presents the right enterprise shape. These are the trust items to mature before larger regulated pilots.
              </p>
            </div>
            <div className="space-y-4">
              {readiness.map((item) => (
                <div key={item} className="flex gap-3 rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-white/75">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-20 rounded-3xl border border-blue-500/20 bg-blue-950/20 p-8 text-center" aria-labelledby="supervised-autonomy-heading">
            <Eye className="mx-auto h-10 w-10 text-blue-300" aria-hidden="true" />
            <h2 id="supervised-autonomy-heading" className="mt-4 text-3xl font-black">Built for supervised autonomy</h2>
            <p className="mx-auto mt-3 max-w-2xl text-white/70">
              D3VONN.IO should not hide agent activity. The product promise is visible work: every agent, every task, every approval, every run.
            </p>
          </section>
        </div>
      </section>
    </PublicPageShell>
  );
};

export default Security;
