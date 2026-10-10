import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Activity, Cloud, FileCheck2, KeyRound, Lock, MonitorCheck, ShieldCheck } from 'lucide-react';

const items = [
  { title: 'System Status', desc: 'Public health indicators and operational readiness signals.', icon: MonitorCheck },
  { title: 'Audit Logs', desc: 'Task checkpoints, approvals, and review trails.', icon: FileCheck2 },
  { title: 'Role-Based Access', desc: 'Workspace roles, admin controls, and permission boundaries.', icon: KeyRound },
  { title: 'Observability', desc: 'Telemetry, queue posture, workflow status, and service health.', icon: Activity },
  { title: 'Deployment Options', desc: 'Cloud-first with a roadmap toward private deployments.', icon: Cloud },
  { title: 'Security Roadmap', desc: 'Security-first product direction without unverified certification claims.', icon: ShieldCheck },
  { title: 'Data Boundaries', desc: 'Clear separation between public preview and authenticated workspace data.', icon: Lock },
];

const TrustCenterPreview: React.FC = () => (
  <section id="trust-center-preview" className="relative overflow-hidden bg-[#052f70] py-24 scroll-mt-24">
    <div className="container relative mx-auto px-6">
      <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">Enterprise Trust Center</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">A clear trust layer for serious AI operations</h2>
          <p className="mt-5 text-blue-100/72">This preview explains how D3VONN.IO presents governance, status, deployment readiness, and security roadmap information to enterprise buyers.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/security" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/35 bg-blue-600/85 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(59,130,246,0.38)] transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200">
              View Security <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/contact?inquiry=enterprise-demo" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/20 bg-white/5 px-6 py-3 text-sm font-semibold text-blue-50 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-200">
              Schedule Demo
            </Link>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-2xl border border-blue-200/15 bg-blue-400/[0.04] p-5 shadow-[0_0_44px_-16px_rgba(56,136,255,0.38)] backdrop-blur-xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/30 bg-blue-500/15 text-blue-100"><Icon className="h-6 w-6" /></div>
                <h3 className="mt-5 text-lg font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm text-blue-100/66">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </section>
);

export default TrustCenterPreview;
