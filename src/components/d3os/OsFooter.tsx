import React from 'react';
import { Link } from 'react-router-dom';

const GROUPS = [
  {
    title: 'Platform',
    links: [
      ['Intelligent Agents', '/agents'],
      ['Automation', '/workflows'],
      ['Knowledge', '/dkos-ingestion'],
      ['Voice & Vision', '/voice-studio'],
      ['Marketplace', '/marketplace'],
    ],
  },
  {
    title: 'Build',
    links: [
      ['Documentation', '/documentation'],
      ['Developer platform', '/api'],
      ['Solutions', '/solutions'],
      ['Pricing', '/pricing'],
      ['System status', '/status'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About', '/about'],
      ['Contact', '/contact'],
      ['Security & trust', '/security'],
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
    ],
  },
] as const;

/** Footer sits on its own light tone, distinct from the page background. */
const OsFooter: React.FC = () => (
  <footer className="border-t border-[color:var(--os-line)] bg-[color:var(--os-footer)] px-4 py-10 md:px-6 md:py-14">
    <div className="mx-auto w-full max-w-7xl">
      <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
        <div className="max-w-sm">
          <div className="os-display text-2xl font-bold tracking-[-0.04em]">
            D3VONN<span style={{ color: 'var(--os-orange)' }}>.IO</span>
          </div>
          <p className="mt-3 text-sm text-[color:var(--os-ink-60)]">
            The AI Business Operating System. Orchestrate agents, automation, knowledge and operations from one governed
            control plane.
          </p>
          <p className="os-mono mt-4 text-[11px] uppercase tracking-[0.18em]">One Platform. Infinite Intelligence.</p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="os-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--os-ink-40)]">{group.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map(([label, to]) => (
                  <li key={to}>
                    <Link to={to} className="cursor-pointer text-sm text-[color:var(--os-ink-60)] hover:text-[color:var(--os-ink)]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="os-rule my-8" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[color:var(--os-ink-40)]">
          &copy; {new Date().getFullYear()} D3VONN.IO. All rights reserved.
        </p>
        <p className="os-mono flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--os-ink-40)]">
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--os-lime-deep)' }} />
          Platform operational
        </p>
      </div>
    </div>
  </footer>
);

export default OsFooter;
