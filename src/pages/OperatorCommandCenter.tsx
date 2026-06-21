import { lazy, Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Users,
  Wrench,
} from 'lucide-react';
import { useOCCData } from '@/hooks/useOCCData';
import OCCOverview from '@/components/occ/OCCOverview';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

// Lazy-load heavy panels
const OCCAIRequestLogs = lazy(() => import('@/components/occ/OCCAIRequestLogs'));
const OCCToolCallLogs = lazy(() => import('@/components/occ/OCCToolCallLogs'));
const OCCAgentActivity = lazy(() => import('@/components/occ/OCCAgentActivity'));
const OCCErrorLogs = lazy(() => import('@/components/occ/OCCErrorLogs'));
const OCCApprovalQueue = lazy(() => import('@/components/occ/OCCApprovalQueue'));
const OCCUserPlans = lazy(() => import('@/components/occ/OCCUserPlans'));
const OCCRAGDocuments = lazy(() => import('@/components/occ/OCCRAGDocuments'));
const OCCHermes = lazy(() => import('@/components/occ/OCCHermes').then(m => ({ default: m.OCCHermes })));

type View =
  | 'overview'
  | 'ai-requests'
  | 'tool-calls'
  | 'agent-activity'
  | 'errors'
  | 'approvals'
  | 'user-plans'
  | 'rag-docs'
  | 'hermes';

interface NavItem {
  id: View;
  label: string;
  icon: React.ReactNode;
  badge?: (data: ReturnType<typeof useOCCData>) => number | null;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    id: 'ai-requests',
    label: 'AI Requests',
    icon: <Activity className="h-4 w-4" />,
    badge: d => d.stats.totalAIRequests > 0 ? d.stats.totalAIRequests : null,
  },
  {
    id: 'tool-calls',
    label: 'Tool Calls',
    icon: <Wrench className="h-4 w-4" />,
    badge: d => d.toolLogs.length > 0 ? d.toolLogs.length : null,
  },
  {
    id: 'agent-activity',
    label: 'Agent Activity',
    icon: <Bot className="h-4 w-4" />,
    badge: d => d.stats.activeAgents > 0 ? d.stats.activeAgents : null,
  },
  {
    id: 'errors',
    label: 'Error Logs',
    icon: <AlertTriangle className="h-4 w-4" />,
    badge: d => d.stats.unresolvedErrors > 0 ? d.stats.unresolvedErrors : null,
  },
  {
    id: 'approvals',
    label: 'Approval Queue',
    icon: <CheckCircle className="h-4 w-4" />,
    badge: d => d.stats.pendingApprovals > 0 ? d.stats.pendingApprovals : null,
  },
  {
    id: 'user-plans',
    label: 'User Plans',
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: 'rag-docs',
    label: 'RAG Documents',
    icon: <FileText className="h-4 w-4" />,
    badge: d => d.stats.totalRAGDocs > 0 ? d.stats.totalRAGDocs : null,
  },
  {
    id: 'hermes',
    label: 'Hermes Fabric',
    icon: <Brain className="h-4 w-4" />,
  },
];

function PanelLoader() {
  return (
    <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
      <D3vonnPageBanner title="Operator Command Center" />
      Loading panel…
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400 mb-4">
      <strong>Data load error:</strong> {message}
      <span className="ml-2 text-gray-400">
        — Ensure the Supabase OCC migration has been run and env vars are configured.
      </span>
    </div>
  );
}

export default function OperatorCommandCenter() {
  const [activeView, setActiveView] = useState<View>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const data = useOCCData();

  function renderPanel() {
    switch (activeView) {
      case 'overview':
        return <OCCOverview stats={data.stats} lastRefreshed={data.lastRefreshed} />;
      case 'ai-requests':
        return (
          <Suspense fallback={<PanelLoader />}>
            <OCCAIRequestLogs logs={data.aiLogs} />
          </Suspense>
        );
      case 'tool-calls':
        return (
          <Suspense fallback={<PanelLoader />}>
            <OCCToolCallLogs logs={data.toolLogs} />
          </Suspense>
        );
      case 'agent-activity':
        return (
          <Suspense fallback={<PanelLoader />}>
            <OCCAgentActivity logs={data.agentLogs} />
          </Suspense>
        );
      case 'errors':
        return (
          <Suspense fallback={<PanelLoader />}>
            <OCCErrorLogs logs={data.errorLogs} />
          </Suspense>
        );
      case 'approvals':
        return (
          <Suspense fallback={<PanelLoader />}>
            <OCCApprovalQueue items={data.approvalQueue} />
          </Suspense>
        );
      case 'user-plans':
        return (
          <Suspense fallback={<PanelLoader />}>
            <OCCUserPlans plans={data.userPlans} />
          </Suspense>
        );
      case 'rag-docs':
        return (
          <Suspense fallback={<PanelLoader />}>
            <OCCRAGDocuments docs={data.ragDocs} />
          </Suspense>
        );
      case 'hermes':
        return (
          <Suspense fallback={<PanelLoader />}>
            <OCCHermes />
          </Suspense>
        );
      default:
        return null;
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-background flex">
        {/* ── Sidebar ───────────────────────────────────── */}
        <aside
          className={`sticky top-16 h-[calc(100vh-4rem)] border-r border-border bg-card/50 flex flex-col transition-all duration-300 ${
            collapsed ? 'w-16' : 'w-60'
          }`}
        >
          {/* Header */}
          <div className={`px-3 py-4 border-b border-border flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
            {!collapsed && (
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-widest">OCC</p>
                <p className="text-[10px] text-gray-500">Operator Command Center</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-white"
              onClick={() => setCollapsed(c => !c)}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
            {NAV_ITEMS.map(item => {
              const isActive = activeView === item.id;
              const badgeCount = item.badge?.(data);
              const btn = (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/15 text-primary font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {badgeCount != null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          item.id === 'errors' || item.id === 'approvals'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-white/10 text-gray-300'
                        }`}>
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                      {badgeCount != null && ` (${badgeCount})`}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return btn;
            })}
          </nav>

          {/* Refresh button */}
          <div className="p-3 border-t border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size={collapsed ? 'icon' : 'sm'}
                  className={`text-gray-400 hover:text-white ${collapsed ? 'w-full justify-center' : 'w-full justify-start gap-2'}`}
                  onClick={data.refresh}
                  disabled={data.loading}
                >
                  <RefreshCw className={`h-4 w-4 ${data.loading ? 'animate-spin' : ''}`} />
                  {!collapsed && <span>{data.loading ? 'Refreshing…' : 'Refresh'}</span>}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Refresh data</TooltipContent>}
            </Tooltip>
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────── */}
        <section aria-label="Operator Command Center content" className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Page title */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {NAV_ITEMS.find(n => n.id === activeView)?.label ?? 'Operator Command Center'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                D3VONN.IO · Production · Auto-refreshes every 30s
              </p>
            </div>

            {/* Error banner */}
            {data.error && <ErrorBanner message={data.error} />}

            {/* Loading skeleton */}
            {data.loading && !data.lastRefreshed && (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            )}

            {/* Panel content */}
            {(!data.loading || data.lastRefreshed) && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {renderPanel()}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}
