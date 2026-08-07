import React from 'react';

interface ProductWorkspaceHeroProps {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  status?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export default function ProductWorkspaceHero({
  eyebrow,
  title,
  description,
  status = 'Operational',
  actions,
  children,
}: ProductWorkspaceHeroProps) {
  return (
    <section className="d3-titanium-panel relative overflow-hidden p-6 sm:p-8 lg:p-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(37,135,255,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_38%)]" />
      <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.72fr)] lg:items-end">
        <div>
          <div className="d3-system-status">{status}</div>
          <p className="d3-kicker mt-6">{eyebrow}</p>
          <h1 className="d3-display-title mt-3 text-4xl font-black text-white sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="d3-section-copy mt-5 text-sm sm:text-base">{description}</p>
          {actions && <div className="mt-7 flex flex-wrap gap-3">{actions}</div>}
        </div>
        {children && <div className="d3-surface p-5 sm:p-6">{children}</div>}
      </div>
    </section>
  );
}
