import React from 'react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BrainCircuit,
  Command,
  Database,
  Network,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import SmartLaunchLink from '@/components/SmartLaunchLink';

interface FooterProps {
  className?: string;
}

const footerGroups = [
  {
    title: 'Platform',
    links: [
      ['AI Workforce', '/agents'],
      ['Automation', '/workflows'],
      ['Marketplace', '/marketplace'],
      ['Command Center', '/command-center'],
      ['AI Film Studio', '/film'],
    ],
  },
  {
    title: 'Build',
    links: [
      ['Documentation', '/documentation'],
      ['Resources', '/resources'],
      ['Solutions', '/solutions'],
      ['Knowledge System', '/dkos-ingestion'],
      ['Developer Platform', '/api'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About', '/about'],
      ['Contact', '/contact'],
      ['Pricing', '/pricing'],
      ['Security & Trust', '/security'],
      ['System Status', '/status'],
    ],
  },
];

const Footer = ({ className }: FooterProps) => {
  return (
    <footer className={cn('relative overflow-hidden border-t border-blue-300/15 bg-[#010611] text-white', className)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(37,126,255,0.14),transparent_34%),radial-gradient(circle_at_90%_100%,rgba(41,171,255,0.08),transparent_34%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/50 to-transparent" />

      <div className="container relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <section className="d3-chrome-panel mb-12 grid gap-8 rounded-[28px] p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-blue-200/70">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              D3VONN.IO Enterprise Intelligence
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
              Build, orchestrate, and govern your AI workforce from one operating system.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
              One governed command layer for agents, workflows, knowledge, security, infrastructure, and business operations.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <SmartLaunchLink
              authedTo="/app"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 text-sm font-semibold text-white shadow-[0_0_34px_rgba(37,126,255,0.38)] transition hover:bg-blue-400"
            >
              Launch D3VONN.IO <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </SmartLaunchLink>
            <Link
              to="/contact"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-200/20 bg-white/[0.035] px-5 text-sm font-semibold text-blue-50 transition hover:border-blue-200/35 hover:bg-blue-300/[0.07]"
            >
              Request a strategy session
            </Link>
          </div>
        </section>

        <div className="grid gap-10 lg:grid-cols-[1.15fr_1.85fr]">
          <div>
            <Link to="/" className="inline-flex items-center" aria-label="D3VONN.IO home">
              <img
                src="/d3vonn-logo.webp"
                alt="D3VONN.IO"
                className="h-16 w-auto max-w-[320px] object-contain object-left drop-shadow-[0_0_24px_rgba(59,130,246,0.42)]"
              />
            </Link>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/55">
              The AI Business Operating System for supervised agent execution, intelligent automation, knowledge operations, and enterprise command visibility.
            </p>
            <p className="mt-4 text-sm font-bold tracking-[0.08em] text-blue-200">
              One Platform. Infinite Intelligence.
            </p>

            <div className="mt-7 grid max-w-md grid-cols-4 gap-2">
              {[
                ['Command', '/command-center', Command],
                ['Agents', '/agents', BrainCircuit],
                ['Knowledge', '/dkos-ingestion', Database],
                ['Trust', '/security', ShieldCheck],
              ].map(([label, to, Icon]) => (
                <Link
                  key={String(label)}
                  to={String(to)}
                  aria-label={String(label)}
                  className="group flex min-h-16 flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/45 transition hover:border-blue-300/20 hover:bg-blue-400/[0.06] hover:text-blue-100"
                >
                  {typeof Icon !== 'string' && <Icon className="h-4 w-4" aria-hidden="true" />}
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em]">{String(label)}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-200/75">{group.title}</h3>
                <ul className="mt-5 space-y-3">
                  {group.links.map(([label, to]) => (
                    <li key={label}>
                      <Link
                        to={to}
                        className="text-sm text-white/52 transition hover:text-blue-200"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-white/10 pt-7 text-sm text-white/38 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>&copy; {new Date().getFullYear()} D3VONN.IO. All rights reserved.</span>
            <span className="inline-flex items-center gap-2 text-emerald-200/65">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_9px_currentColor]" />
              Platform operational
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/privacy" className="transition hover:text-blue-200">Privacy</Link>
            <Link to="/terms" className="transition hover:text-blue-200">Terms</Link>
            <Link to="/security" className="inline-flex items-center gap-1.5 transition hover:text-blue-200">
              Security <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link to="/solutions" className="inline-flex items-center gap-1.5 transition hover:text-blue-200">
              Explore <Network className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
