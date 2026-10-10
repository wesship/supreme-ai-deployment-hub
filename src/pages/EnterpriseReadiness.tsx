import { Helmet } from 'react-helmet-async';
import PublicPageShell from '@/components/shell/PublicPageShell';

const controls = [
  ['Identity and access', 'Authenticated workspaces and role separation', 'SSO, SCIM, and expanded RBAC policy controls', '30 September 2026'],
  ['Audit evidence', 'Structured system, approval, and MCP execution audit records', 'Customer-facing export and retention policy controls', '31 October 2026'],
  ['Data boundaries', 'Backend-routed AI, RAG, and tool calls; CSP and gateway egress constraints', 'Deployment-specific data residency options', '31 October 2026'],
  ['Assurance and certification', 'Security disclosure process, evidence ledger, and operational transparency', 'SOC 2 readiness mapping for regulated pilots', '31 December 2026'],
  ['Deployment modes', 'Cloud-first managed deployment', 'Private, VPC, and sovereign deployment paths', '31 December 2026'],
];

export default function EnterpriseReadiness() {
  return <PublicPageShell breadcrumbs={[{ label: 'Enterprise' }, { label: 'Readiness' }]}><Helmet><title>Enterprise Readiness | D3VONN.IO</title><meta name="description" content="Current enterprise controls and dated D3VONN.IO capability milestones." /><link rel="canonical" href="https://www.d3vonn.io/enterprise-readiness" /></Helmet><section className="container mx-auto max-w-6xl px-4 py-12 text-white"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Enterprise readiness</p><h1 className="mt-3 text-4xl font-bold">Current controls, clear evidence, dated milestones</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-white/70">This matrix distinguishes capabilities available today from planned milestones. It is an operational commitment, not a substitute for a customer-specific security review.</p><div className="mt-10 overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-white/55"><tr><th className="p-4">Control area</th><th className="p-4">Current</th><th className="p-4">Roadmap</th><th className="p-4">Target</th></tr></thead><tbody>{controls.map(([area, current, roadmap, target]) => <tr key={area} className="border-t border-white/10 align-top"><th className="p-4 font-medium">{area}</th><td className="p-4 text-white/70">{current}</td><td className="p-4 text-white/70">{roadmap}</td><td className="p-4 text-cyan-200">{target}</td></tr>)}</tbody></table></div></section></PublicPageShell>;
}
