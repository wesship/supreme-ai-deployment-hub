import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command as CommandPrimitive } from 'cmdk';
import {
  Activity,
  Bot,
  Clapperboard,
  Code2,
  Command,
  Database,
  Film,
  Gauge,
  LockKeyhole,
  Network,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';

const OPEN_EVENT = 'd3vonn:open-command-palette';

export const openD3CommandPalette = () => {
  window.dispatchEvent(new Event(OPEN_EVENT));
};

type CommandItem = {
  label: string;
  description: string;
  to: string;
  keywords: string;
  icon: React.ElementType;
  group: 'Command Deck' | 'Intelligence' | 'Create & Execute' | 'Enterprise';
};

const items: CommandItem[] = [
  { label: 'Command Center', description: 'Open the D3VONN.IO operating command layer', to: '/command-center', keywords: 'home nexus operations command', icon: Command, group: 'Command Deck' },
  { label: 'Business OS', description: 'Open the authenticated business operating workspace', to: '/app', keywords: 'business dashboard executive operations', icon: Gauge, group: 'Command Deck' },
  { label: 'System Status', description: 'Review platform health and runtime status', to: '/status', keywords: 'health uptime telemetry runtime', icon: Activity, group: 'Command Deck' },
  { label: 'PRIMETIME CRM', description: 'Insurance agent operating system — leads, pipeline, scheduling, communications, and AI assistance', to: '/primetime', keywords: 'primetime crm insurance leads pipeline scheduling communications ai', icon: Gauge, group: 'Command Deck' },
  { label: 'PRIMETIME Scheduling', description: 'Appointment scheduling, availability rules, and calendar management', to: '/primetime/scheduling', keywords: 'primetime scheduling appointments calendar availability', icon: Activity, group: 'Command Deck' },
  { label: 'PRIMETIME Communications', description: 'Consent-governed communications and messaging', to: '/primetime/communications', keywords: 'primetime communications messaging consent', icon: Network, group: 'Command Deck' },
  { label: 'PRIMETIME AI Assistance', description: 'Draft-first AI agent assistance with governance controls', to: '/primetime/ai-assistance', keywords: 'primetime ai assistance agents drafts governance', icon: Bot, group: 'Command Deck' },
  { label: 'PRIMETIME Executive Command Center', description: 'Analytics dashboard and governance observations', to: '/primetime/executive-command-center', keywords: 'primetime analytics executive dashboard metrics', icon: Gauge, group: 'Command Deck' },
  { label: 'PRIMETIME Agent OS Canary', description: 'Certify production Agent OS governance, audit evidence, and emergency stop controls', to: '/primetime/agent-os-canary', keywords: 'primetime agent os canary production kill switch governance audit owner', icon: ShieldAlert, group: 'Command Deck' },
  { label: 'AI Workforce', description: 'Manage specialized AI agents and roles', to: '/ai-workforce', keywords: 'agents workforce hermes operator strategist', icon: Bot, group: 'Intelligence' },
  { label: 'Knowledge', description: 'Open knowledge ingestion and graph workflows', to: '/knowledge-ingestion', keywords: 'knowledge graph rag dkos documents', icon: Network, group: 'Intelligence' },
  { label: 'Research OS', description: 'Open deep research and evidence workflows', to: '/research-os', keywords: 'research evidence citations analysis', icon: Search, group: 'Intelligence' },
  { label: 'Automation', description: 'Build and manage governed workflows', to: '/workflows', keywords: 'workflow automation operator execute', icon: Workflow, group: 'Create & Execute' },
  { label: 'AI Films', description: 'Open the AI film production workspace', to: '/ai-films', keywords: 'film studio video movie production creator', icon: Film, group: 'Create & Execute' },
  { label: 'Voice Studio', description: 'Open speech and conversation intelligence', to: '/voice-studio', keywords: 'voice speech audio calls elevenlabs vapi', icon: Sparkles, group: 'Create & Execute' },
  { label: 'Marketplace', description: 'Browse agents, tools, and automation assets', to: '/marketplace', keywords: 'marketplace agents tools templates', icon: Clapperboard, group: 'Create & Execute' },
  { label: 'Security', description: 'Open the enterprise trust and security layer', to: '/security', keywords: 'security trust zero trust compliance', icon: ShieldCheck, group: 'Enterprise' },
  { label: 'Security Operations', description: 'Open the security operations workspace', to: '/security/ops', keywords: 'soc alerts incidents detections', icon: LockKeyhole, group: 'Enterprise' },
  { label: 'Developers', description: 'Open APIs and developer controls', to: '/api', keywords: 'developers api sdk integration', icon: Code2, group: 'Enterprise' },
  { label: 'Documentation', description: 'Search technical documentation and architecture', to: '/documentation', keywords: 'docs documentation api guides architecture', icon: Database, group: 'Enterprise' },
  { label: 'Settings', description: 'Open system and account settings', to: '/app', keywords: 'settings preferences account configuration', icon: Settings, group: 'Enterprise' },
];

const groups: CommandItem['group'][] = ['Command Deck', 'Intelligence', 'Create & Execute', 'Enterprise'];

const D3CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }

      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        setOpen(true);
      }

      if (event.key === 'Escape') setOpen(false);
    };

    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const groupedItems = useMemo(
    () => groups.map((group) => ({ group, items: items.filter((item) => item.group === group) })),
    []
  );

  if (!open) return null;

  const select = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-[#01040b]/82 px-4 pt-[12vh] backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="D3VONN.IO Command Palette">
      <button className="absolute inset-0 cursor-default" aria-label="Close command palette" onClick={() => setOpen(false)} />

      <div className="d3-command-palette relative z-10 w-full max-w-3xl overflow-hidden rounded-[28px] border border-blue-300/20 bg-[#050b18]/96 shadow-[0_40px_140px_rgba(0,18,64,0.7)]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="d3-core-mini" aria-hidden="true"><span /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-200/55">D3VONN.IO</p>
              <p className="mt-0.5 text-sm font-semibold text-white">Command Nexus</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-white/55 transition hover:bg-white/[0.08] hover:text-white" aria-label="Close command palette">
            <X className="h-4 w-4" />
          </button>
        </div>

        <CommandPrimitive label="D3VONN.IO Command Nexus" shouldFilter>
          <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 sm:px-6">
            <Search className="h-5 w-5 shrink-0 text-blue-200/70" aria-hidden="true" />
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              autoFocus
              placeholder="Search workspaces, agents, security, documentation…"
              className="h-16 w-full bg-transparent text-base text-white outline-none placeholder:text-white/30"
            />
            <span className="hidden rounded-md border border-white/10 bg-black/25 px-2 py-1 font-mono text-[10px] text-white/35 sm:inline">ESC</span>
          </div>

          <CommandPrimitive.List className="max-h-[58vh] overflow-y-auto p-3 sm:p-4">
            <CommandPrimitive.Empty className="px-4 py-10 text-center text-sm text-white/45">
              No D3VONN.IO command matches “{query}”.
            </CommandPrimitive.Empty>

            {groupedItems.map(({ group, items: groupItems }) => (
              <CommandPrimitive.Group key={group} heading={group} className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-200/35 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-2">
                {groupItems.map(({ label, description, to, keywords, icon: Icon }) => (
                  <CommandPrimitive.Item
                    key={label}
                    value={`${label} ${description} ${keywords}`}
                    onSelect={() => select(to)}
                    className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-transparent px-3 py-3 text-left outline-none data-[selected=true]:border-blue-300/20 data-[selected=true]:bg-blue-400/[0.08]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-300/12 bg-blue-400/[0.055] text-blue-200 transition group-data-[selected=true]:border-blue-300/28 group-data-[selected=true]:bg-blue-400/[0.11]">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold normal-case tracking-normal text-white">{label}</div>
                      <div className="mt-1 truncate text-xs font-normal normal-case tracking-normal text-white/40">{description}</div>
                    </div>
                    <span className="text-[10px] font-semibold normal-case tracking-normal text-blue-200/30 group-data-[selected=true]:text-blue-200/70">Open</span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            ))}
          </CommandPrimitive.List>
        </CommandPrimitive>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-3 text-[10px] text-white/30 sm:px-6">
          <span>One command layer across the D3VONN.IO operating system.</span>
          <span className="font-mono">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
};

export default D3CommandPalette;