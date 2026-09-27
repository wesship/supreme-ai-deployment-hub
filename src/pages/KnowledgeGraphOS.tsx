import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '@/styles/knowledge-graph-effects.css';
import ConversationalVoiceControls from '@/components/ai/ConversationalVoiceControls';
import { supabase } from '@/integrations/supabase/client';
import { API_BASE_URL } from '@/services/config';
import {
  Activity,
  Bot,
  BrainCircuit,
  ChevronRight,
  Database,
  Eye,
  Film,
  Network,
  Play,
  Radio,
  Search,
  Mic,
  ShieldCheck,
  Sparkles,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react';

type NodeKind = 'core' | 'agent' | 'tool' | 'memory' | 'product' | 'security';

type HermesRealtimeState = 'connecting' | 'live' | 'error';

type HermesEventRow = {
  id: string;
  task_id: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type HermesTaskRow = {
  id: string;
  parent_task_id?: string | null;
  goal_id?: string | null;
  agent_name?: string | null;
  task_type?: string | null;
  kind: string;
  title: string | null;
  status: string;
  depth?: number | null;
  created_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  retry_count?: number | null;
};

type HermesInterruptRow = {
  id: string;
  task_id: string;
  status: 'pending' | 'approved' | 'rejected';
  prompt: string;
  created_at: string;
};

type HermesCheckpointRow = {
  id: string;
  task_id?: string | null;
  goal_id?: string | null;
  title: string;
  content: string;
  created_at: string;
};

type TimelineItem = {
  id: string;
  kind: 'event' | 'checkpoint' | 'interrupt';
  title: string;
  detail: string;
  created_at: string;
  status?: string;
};

type HermesRunRow = {
  id: string;
  task_id: string;
  agent_name: string;
  run_number: number;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  tokens_used: number | null;
  cost_usd: number | string | null;
  error_detail: string | null;
  output_snapshot?: Record<string, unknown> | null;
};

type HermesLogRow = {
  id: string;
  task_id: string | null;
  run_id: string | null;
  agent_name: string | null;
  event: string;
  message: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
};

type GraphFinding = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  label: string;
  evidence: string;
  recommendation: string;
};

type SystemHealthRow = {
  key: string;
  label: string;
  tasks: number;
  failed: number;
  retries: number;
  runs: number;
  duration_ms: number;
  cost_usd: number;
  run_tasks: number;
};

type AdaptiveProposal = {
  id: string;
  category: 'routing' | 'agent' | 'tool' | 'concurrency' | 'workflow';
  target: string;
  reason: string;
  proposal: string;
  guardrail: string;
  severity: 'info' | 'warning' | 'critical';
};

type AdaptiveChangeRequestRow = {
  id: string;
  proposal_id: string;
  category: AdaptiveProposal['category'];
  target: string;
  severity: AdaptiveProposal['severity'];
  risk_classification: 'low' | 'medium' | 'high' | 'critical';
  evidence_hash: string;
  proposed_change: Record<string, unknown>;
  guardrail: string;
  rollback_plan: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'canary_queued' | 'canary_completed' | 'canary_failed';
  review_rationale: string | null;
  canary_task_id: string | null;
  created_at: string;
};

type AdaptiveAuditRow = {
  id: string;
  change_request_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
};

type AdaptivePromotionCandidateRow = {
  id: string;
  change_request_id: string;
  certification_id: string;
  proposed_change: Record<string, unknown>;
  evidence_hash: string;
  status: 'pending_promotion_review' | 'approved' | 'rejected' | 'promoted';
  created_at: string;
};

type AdaptiveRolloutRow = {
  id: string;
  promotion_candidate_id: string;
  environment: 'staging' | 'production';
  approved_delta: Record<string, unknown>;
  rollback_config: Record<string, unknown>;
  status: 'validated' | 'applied' | 'rolled_back' | 'failed';
  runtime_changed: boolean;
  deployment_evidence: Record<string, unknown>;
  created_at: string;
};

type KnowledgeNodeData = {
  label: string;
  kind: NodeKind;
  route: string;
  description: string;
  state: 'ready' | 'governed' | 'adapter';
};

const kindLabel: Record<NodeKind, string> = {
  core: 'Orchestration',
  agent: 'Agent',
  tool: 'Tool / MCP',
  memory: 'Knowledge',
  product: 'Product',
  security: 'Governance',
};

const kindIcon: Record<NodeKind, React.ElementType> = {
  core: BrainCircuit,
  agent: Bot,
  tool: Wrench,
  memory: Database,
  product: Sparkles,
  security: ShieldCheck,
};

const stateLabel: Record<KnowledgeNodeData['state'], string> = {
  ready: 'Route ready',
  governed: 'Governed',
  adapter: 'Adapter-ready',
};

const initialNodes: Array<Node<KnowledgeNodeData>> = [
  {
    id: 'intent',
    type: 'knowledge',
    position: { x: 0, y: 220 },
    data: {
      label: 'User Intent',
      kind: 'core',
      route: '/app',
      description: 'Entry point for goals, requests, and operator-directed work.',
      state: 'governed',
    },
  },
  {
    id: 'hermes',
    type: 'knowledge',
    position: { x: 270, y: 210 },
    data: {
      label: 'Hermes',
      kind: 'core',
      route: '/workflows',
      description: 'Plans, routes, and coordinates agent execution across D3VONN.',
      state: 'governed',
    },
  },
  {
    id: 'agents',
    type: 'knowledge',
    position: { x: 560, y: 45 },
    data: {
      label: 'AI Workforce',
      kind: 'agent',
      route: '/agents',
      description: 'Reusable specialist agents selected by Hermes for governed tasks.',
      state: 'ready',
    },
  },
  {
    id: 'knowledge',
    type: 'knowledge',
    position: { x: 560, y: 210 },
    data: {
      label: 'Knowledge + RAG',
      kind: 'memory',
      route: '/dkos-ingestion',
      description: 'Context, retrieval, ingestion, and graph-aware memory surfaces.',
      state: 'adapter',
    },
  },
  {
    id: 'tools',
    type: 'knowledge',
    position: { x: 560, y: 375 },
    data: {
      label: 'Tools + MCP',
      kind: 'tool',
      route: '/mcp',
      description: 'Governed connectors, tools, APIs, and external action surfaces.',
      state: 'governed',
    },
  },
  {
    id: 'workflow',
    type: 'knowledge',
    position: { x: 860, y: 95 },
    data: {
      label: 'Workflow Engine',
      kind: 'core',
      route: '/workflows',
      description: 'Execution plans, task chains, approvals, and resumable workflows.',
      state: 'ready',
    },
  },
  {
    id: 'films',
    type: 'knowledge',
    position: { x: 1130, y: 15 },
    data: {
      label: 'AI Films',
      kind: 'product',
      route: '/ai-films',
      description: 'Character, voice, visual, and governed media production workflows.',
      state: 'ready',
    },
  },
  {
    id: 'radio',
    type: 'knowledge',
    position: { x: 1130, y: 175 },
    data: {
      label: 'HNF Radio',
      kind: 'product',
      route: '/music',
      description: 'Media orchestration surface for voice, scheduling, and broadcast workflows.',
      state: 'adapter',
    },
  },
  {
    id: 'security',
    type: 'knowledge',
    position: { x: 860, y: 345 },
    data: {
      label: 'Security + Trust',
      kind: 'security',
      route: '/security/command-center',
      description: 'Policy, secrets, approvals, observability, and operating boundaries.',
      state: 'governed',
    },
  },
  {
    id: 'analytics',
    type: 'knowledge',
    position: { x: 1130, y: 340 },
    data: {
      label: 'Operations',
      kind: 'core',
      route: '/command-center',
      description: 'Operator-facing state, status, and command surfaces.',
      state: 'ready',
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'intent-hermes', source: 'intent', target: 'hermes' },
  { id: 'hermes-agents', source: 'hermes', target: 'agents' },
  { id: 'hermes-knowledge', source: 'hermes', target: 'knowledge' },
  { id: 'hermes-tools', source: 'hermes', target: 'tools' },
  { id: 'agents-workflow', source: 'agents', target: 'workflow' },
  { id: 'knowledge-workflow', source: 'knowledge', target: 'workflow' },
  { id: 'tools-security', source: 'tools', target: 'security' },
  { id: 'workflow-films', source: 'workflow', target: 'films' },
  { id: 'workflow-radio', source: 'workflow', target: 'radio' },
  { id: 'workflow-analytics', source: 'workflow', target: 'analytics' },
  { id: 'security-analytics', source: 'security', target: 'analytics' },
].map((edge) => ({
  ...edge,
  markerEnd: { type: MarkerType.ArrowClosed },
  animated: edge.source === 'hermes',
  style: { strokeWidth: 1.5 },
}));

const bridgeIdeas = [
  {
    id: 'instructor',
    title: 'AI Films → Academy Instructor',
    reason: 'Character + voice capabilities can become a reusable instructor persona when attached to curriculum and learner memory.',
    path: ['AI Films', 'Character Registry', 'Voice Profile', 'Curriculum Agent', 'Learner Memory'],
  },
  {
    id: 'radio-memory',
    title: 'HNF Radio → Knowledge Memory',
    reason: 'Broadcast planning becomes more useful when shows, guests, rights metadata, and prior segments become graph-addressable context.',
    path: ['HNF Radio', 'Show Metadata', 'Knowledge Graph', 'Hermes', 'Next Broadcast'],
  },
  {
    id: 'ops-feedback',
    title: 'Operations → Agent Improvement',
    reason: 'Execution outcomes can feed governed observations back into routing and agent selection without silently self-modifying.',
    path: ['Operations', 'Outcome Event', 'Review Gate', 'Hermes', 'Agent Routing'],
  },
];

function KnowledgeNode({ data, selected }: NodeProps<Node<KnowledgeNodeData>>) {
  const Icon = kindIcon[data.kind];
  return (
    <div
      className={[
        'd3-kg-node min-w-[210px] border border-[#34332f] bg-[#141411] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition',
        selected
          ? 'd3-kg-node--active border-amber-300 bg-[#1b1913] shadow-[inset_3px_0_0_#fcd34d,0_10px_28px_rgba(0,0,0,0.35)]'
          : 'd3-kg-node--idle border-[#34332f] bg-[#141411] hover:border-[#665f46]',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Left} className="d3-kg-handle !h-2 !w-2 !border-0 !bg-amber-200/70" />
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center border border-[#34332f] bg-[#0c0c0a]">
          <Icon className="h-5 w-5 text-amber-100" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-stone-50">{data.label}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">{kindLabel[data.kind]}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] font-medium text-stone-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
        {stateLabel[data.state]}
      </div>
      <Handle type="source" position={Position.Right} className="d3-kg-handle !h-2 !w-2 !border-0 !bg-amber-200/70" />
    </div>
  );
}

const nodeTypes = { knowledge: KnowledgeNode };

const extractCorrelation = (payload: Record<string, unknown> | null): string | null => {
  if (!payload) return null;
  for (const key of ['correlation_id', 'correlationId', 'request_id', 'requestId', 'trace_id', 'traceId']) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const formatDuration = (task: HermesTaskRow | null): string => {
  if (!task?.created_at) return '—';
  const start = new Date(task.created_at).getTime();
  const end = task.completed_at ? new Date(task.completed_at).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—';
  const ms = end - start;
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
};

const livePathForSignal = (signal: string): string[] => {
  const value = signal.toLowerCase();
  const terminal = value.includes('complete') || value.includes('completed') || value.includes('result') || value.includes('failed') || value.includes('cancelled');
  if (terminal) {
    return ['intent', 'hermes', 'agents', 'workflow', 'analytics'];
  }
  if (value.includes('film') || value.includes('character') || value.includes('video')) {
    return ['intent', 'hermes', 'agents', 'workflow', 'films'];
  }
  if (value.includes('radio') || value.includes('broadcast') || value.includes('audio')) {
    return ['intent', 'hermes', 'agents', 'workflow', 'radio'];
  }
  if (value.includes('security') || value.includes('approval') || value.includes('interrupt') || value.includes('policy')) {
    return ['intent', 'hermes', 'tools', 'security'];
  }
  if (value.includes('tool') || value.includes('mcp') || value.includes('connector')) {
    return ['intent', 'hermes', 'tools'];
  }
  if (value.includes('rag') || value.includes('memory') || value.includes('knowledge') || value.includes('retriev')) {
    return ['intent', 'hermes', 'knowledge'];
  }
  if (value.includes('agent') || value.includes('worker') || value.includes('delegate')) {
    return ['intent', 'hermes', 'agents'];
  }
  if (value.includes('workflow')) {
    return ['intent', 'hermes', 'agents', 'workflow', 'analytics'];
  }
  return ['intent', 'hermes'];
};

const KnowledgeGraphOS: React.FC = () => {
  const [selectedId, setSelectedId] = useState('hermes');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<NodeKind | 'all'>('all');
  const [activity, setActivity] = useState<string[]>(['Graph surface initialized. No live mutations have been issued.']);
  const [executionPath, setExecutionPath] = useState<string[]>([]);
  const [executionStep, setExecutionStep] = useState(-1);
  const [realtimeState, setRealtimeState] = useState<HermesRealtimeState>('connecting');
  const [lastLiveEvent, setLastLiveEvent] = useState<string>('Waiting for Hermes event…');
  const [liveTask, setLiveTask] = useState<HermesTaskRow | null>(null);
  const [liveEvent, setLiveEvent] = useState<HermesEventRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [pendingInterrupt, setPendingInterrupt] = useState<HermesInterruptRow | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [runs, setRuns] = useState<HermesRunRow[]>([]);
  const [taskLogs, setTaskLogs] = useState<HermesLogRow[]>([]);
  const [parentTask, setParentTask] = useState<HermesTaskRow | null>(null);
  const [childTasks, setChildTasks] = useState<HermesTaskRow[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthRow[]>([]);
  const [systemHealthLoading, setSystemHealthLoading] = useState(false);
  const [systemHealthError, setSystemHealthError] = useState<string | null>(null);
  const [systemHealthUpdatedAt, setSystemHealthUpdatedAt] = useState<Date | null>(null);
  const [changeRequests, setChangeRequests] = useState<AdaptiveChangeRequestRow[]>([]);
  const [changeAudit, setChangeAudit] = useState<AdaptiveAuditRow[]>([]);
  const [reviewNote, setReviewNote] = useState('Reviewed against current evidence and rollback guardrails.');
  const [changeBusy, setChangeBusy] = useState<string | null>(null);
  const [promotionCandidates, setPromotionCandidates] = useState<AdaptivePromotionCandidateRow[]>([]);
  const [rollouts, setRollouts] = useState<AdaptiveRolloutRow[]>([]);
  const [productionAuthorization, setProductionAuthorization] = useState('');
  const timelineRequestRef = useRef(0);

  const selected = initialNodes.find((node) => node.id === selectedId) ?? initialNodes[1];
  const voiceContext = {
    surface: 'knowledge-graph',
    route: '/knowledge-graph',
    node_id: selected.id,
    node_label: selected.data.label,
    node_kind: selected.data.kind,
    canonical_route: selected.data.route,
  };

  useEffect(() => {
    let mounted = true;
    setRealtimeState('connecting');

    const applyLivePath = (path: string[], message: string) => {
      if (!mounted) return;
      setExecutionPath(path);
      setExecutionStep(Math.max(0, path.length - 1));
      setLastLiveEvent(message);
      setActivity((items) => [`LIVE · ${message}`, ...items].slice(0, 5));
    };

    const channel = supabase
      .channel('knowledge-graph-hermes-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hermes_events' },
        (payload) => {
          const row = payload.new as HermesEventRow;
          setLiveEvent(row);
          const signal = `${row.event_type} ${JSON.stringify(row.payload ?? {})}`;
          applyLivePath(livePathForSignal(signal), row.event_type);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hermes_tasks' },
        (payload) => {
          const row = payload.new as HermesTaskRow;
          if (!row?.id) return;
          setLiveTask(row);
          const signal = `${row.task_type ?? ''} ${row.agent_name ?? ''} ${row.kind} ${row.title ?? ''} ${row.status}`;
          applyLivePath(livePathForSignal(signal), `task ${row.status}: ${row.title ?? row.kind}`);
        },
      )
      .subscribe((status) => {
        if (!mounted) return;
        if (status === 'SUBSCRIBED') setRealtimeState('live');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeState('error');
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const refreshSystemHealth = async () => {
    setSystemHealthLoading(true);
    setSystemHealthError(null);
    try {
      const [tasksRes, runsRes] = await Promise.all([
        supabase
          .from('hermes_tasks')
          .select('id,kind,title,status,agent_name,retry_count,created_at')
          .order('created_at', { ascending: false })
          .limit(250),
        supabase
          .from('hermes_runs')
          .select('id,task_id,agent_name,status,duration_ms,cost_usd,created_at')
          .order('created_at', { ascending: false })
          .limit(500),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (runsRes.error) throw runsRes.error;

      const recentTasks = (tasksRes.data ?? []) as unknown as HermesTaskRow[];
      const recentRuns = (runsRes.data ?? []) as unknown as HermesRunRow[];
      const taskById = new Map(recentTasks.map((task) => [task.id, task]));
      const buckets = new Map<string, SystemHealthRow>();
      const runTaskIds = new Map<string, Set<string>>();

      const normalizeAgent = (value?: string | null) => {
        const trimmed = value?.trim();
        return trimmed ? trimmed.toUpperCase() : 'UNASSIGNED';
      };
      const ensure = (key: string, label: string) => {
        if (!buckets.has(key)) {
          buckets.set(key, { key, label, tasks: 0, failed: 0, retries: 0, runs: 0, duration_ms: 0, cost_usd: 0, run_tasks: 0 });
        }
        return buckets.get(key)!;
      };

      for (const task of recentTasks) {
        const normalized = normalizeAgent(task.agent_name);
        const status = task.status.toUpperCase();
        // PENDING/PAUSED tasks may intentionally be unassigned before dispatch.
        if (normalized === 'UNASSIGNED' && (status === 'PENDING' || status === 'PAUSED')) continue;
        const label = normalized === 'UNASSIGNED' ? 'Unassigned' : normalized;
        const key = `agent:${normalized}`;
        const row = ensure(key, label);
        row.tasks += 1;
        if (status === 'FAILED') row.failed += 1;
        row.retries += task.retry_count ?? 0;
      }

      for (const run of recentRuns) {
        const task = taskById.get(run.task_id);
        // Keep cost/latency population aligned to the loaded task window.
        if (!task) continue;
        const normalized = normalizeAgent(run.agent_name || task.agent_name);
        const label = normalized === 'UNASSIGNED' ? 'Unassigned' : normalized;
        const key = `agent:${normalized}`;
        const row = ensure(key, label);
        row.runs += 1;
        row.duration_ms += run.duration_ms ?? 0;
        row.cost_usd += Number(run.cost_usd ?? 0);
        const ids = runTaskIds.get(key) ?? new Set<string>();
        ids.add(run.task_id);
        runTaskIds.set(key, ids);
        row.run_tasks = ids.size;
      }

      setSystemHealth(
        Array.from(buckets.values())
          .sort((a, b) => {
            const pressureA = a.failed * 5 + a.retries * 2 + a.duration_ms / 30_000 + a.cost_usd * 10;
            const pressureB = b.failed * 5 + b.retries * 2 + b.duration_ms / 30_000 + b.cost_usd * 10;
            return pressureB - pressureA;
          })
          .slice(0, 12),
      );
      setSystemHealthUpdatedAt(new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'System health load failed';
      setSystemHealthError(message);
      setActivity((items) => [`System health error: ${message}`, ...items].slice(0, 5));
    } finally {
      setSystemHealthLoading(false);
    }
  };

  useEffect(() => {
    refreshSystemHealth();
    const timer = window.setInterval(refreshSystemHealth, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshTaskTimeline = async (task: HermesTaskRow | null) => {
    const requestId = ++timelineRequestRef.current;
    if (!task?.id) {
      setTimeline([]);
      setPendingInterrupt(null);
      setRuns([]);
      setTaskLogs([]);
      setParentTask(null);
      setChildTasks([]);
      return;
    }
    setTimeline([]);
    setTimelineError(null);
    setPendingInterrupt(null);
    setRuns([]);
    setTaskLogs([]);
    setParentTask(null);
    setChildTasks([]);
    setTimelineLoading(true);
    try {
      const eventQuery = supabase
        .from('hermes_events')
        .select('id,task_id,event_type,payload,created_at')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false })
        .limit(40);

      const interruptQuery = supabase
        .from('hermes_interrupts')
        .select('id,task_id,status,prompt,created_at')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const checkpointQuery = task.goal_id
        ? supabase
            .from('hermes_checkpoints')
            .select('id,goal_id,title,content,created_at')
            .eq('goal_id', task.goal_id)
            .order('created_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null });

      const runQuery = supabase
        .from('hermes_runs')
        .select('id,task_id,agent_name,run_number,status,started_at,finished_at,duration_ms,tokens_used,cost_usd,error_detail,output_snapshot')
        .eq('task_id', task.id)
        .order('run_number', { ascending: false })
        .limit(20);

      const logQuery = supabase
        .from('hermes_logs')
        .select('id,task_id,run_id,agent_name,event,message,data,created_at')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false })
        .limit(60);

      const childQuery = supabase
        .from('hermes_tasks')
        .select('id,parent_task_id,goal_id,kind,title,status,depth,created_at,completed_at,error_message,agent_name,retry_count')
        .eq('parent_task_id', task.id)
        .order('created_at', { ascending: true })
        .limit(50);

      const parentQuery = task.parent_task_id
        ? supabase
            .from('hermes_tasks')
            .select('id,parent_task_id,goal_id,kind,title,status,depth,created_at,completed_at,error_message,agent_name,retry_count')
            .eq('id', task.parent_task_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [eventsRes, interruptsRes, checkpointsRes, runsRes, logsRes, childrenRes, parentRes] = await Promise.all([
        eventQuery,
        interruptQuery,
        checkpointQuery,
        runQuery,
        logQuery,
        childQuery,
        parentQuery,
      ]);

      if (eventsRes.error) throw eventsRes.error;
      if (interruptsRes.error) throw interruptsRes.error;
      if (checkpointsRes.error) throw checkpointsRes.error;
      if (runsRes.error) throw runsRes.error;
      if (logsRes.error) throw logsRes.error;
      if (childrenRes.error) throw childrenRes.error;
      if (parentRes.error) throw parentRes.error;

      const events = (eventsRes.data ?? []) as unknown as HermesEventRow[];
      const interrupts = (interruptsRes.data ?? []) as unknown as HermesInterruptRow[];
      const checkpoints = (checkpointsRes.data ?? []) as unknown as HermesCheckpointRow[];
      const nextRuns = (runsRes.data ?? []) as unknown as HermesRunRow[];
      const nextLogs = (logsRes.data ?? []) as unknown as HermesLogRow[];
      const children = (childrenRes.data ?? []) as unknown as HermesTaskRow[];
      const parent = (parentRes.data ?? null) as unknown as HermesTaskRow | null;

      if (requestId !== timelineRequestRef.current) return;
      setRuns(nextRuns);
      setTaskLogs(nextLogs);
      setChildTasks(children);
      setParentTask(parent);

      setPendingInterrupt(interrupts.find((item) => item.status === 'pending') ?? null);
      setTimeline(
        [
          ...events.map((item): TimelineItem => ({
            id: `event-${item.id}`,
            kind: 'event',
            title: item.event_type,
            detail: JSON.stringify(item.payload ?? {}),
            created_at: item.created_at,
          })),
          ...interrupts.map((item): TimelineItem => ({
            id: `interrupt-${item.id}`,
            kind: 'interrupt',
            title: 'Human approval',
            detail: item.prompt,
            created_at: item.created_at,
            status: item.status,
          })),
          ...checkpoints.map((item): TimelineItem => ({
            id: `checkpoint-${item.id}`,
            kind: 'checkpoint',
            title: item.title,
            detail: item.content,
            created_at: item.created_at,
          })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      );
    } catch (error) {
      if (requestId !== timelineRequestRef.current) return;
      const message = error instanceof Error ? error.message : 'Timeline load failed';
      setTimelineError(message);
      setActivity((items) => [`Timeline error: ${message}`, ...items].slice(0, 5));
    } finally {
      if (requestId === timelineRequestRef.current) setTimelineLoading(false);
    }
  };

  useEffect(() => {
    refreshTaskTimeline(liveTask);
  }, [liveTask?.id, liveTask?.status]);

  const callGovernedAction = async (
    endpoint: string,
    body: Record<string, string>,
    label: string,
  ) => {
    setActionBusy(label);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in is required for governed Hermes actions.');
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload?.detail === 'string' ? payload.detail : `${label} failed`);
      }
      setActivity((items) => [`${label} accepted by governed Hermes API.`, ...items].slice(0, 5));
      await refreshTaskTimeline(liveTask);
    } catch (error) {
      const message = error instanceof Error ? error.message : `${label} failed`;
      setActivity((items) => [`${label} blocked: ${message}`, ...items].slice(0, 5));
    } finally {
      setActionBusy(null);
    }
  };

  const mutateLiveTask = async (action: 'cancel' | 'retry' | 'pause' | 'resume') => {
    if (!liveTask?.id) return;
    await callGovernedAction(
      `/api/hermes/tasks/${encodeURIComponent(liveTask.id)}/action`,
      { action },
      `Task ${action}`,
    );
  };

  const resolveLiveInterrupt = async (status: 'approved' | 'rejected') => {
    if (!pendingInterrupt?.id) return;
    setActionBusy(status);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in is required for approval decisions.');
      const response = await fetch(
        `${API_BASE_URL}/api/hermes/interrupts/${encodeURIComponent(pendingInterrupt.id)}?status_unused=1`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : `Interrupt ${status} failed`);
      setActivity((items) => [`Interrupt ${status}: ${pendingInterrupt.id}`, ...items].slice(0, 5));
      await refreshTaskTimeline(liveTask);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Interrupt ${status} failed`;
      setActivity((items) => [`Approval action blocked: ${message}`, ...items].slice(0, 5));
    } finally {
      setActionBusy(null);
    }
  };

  useEffect(() => {
    if (!executionPath.length) return;
    setExecutionStep(0);
    const timer = window.setInterval(() => {
      setExecutionStep((step) => {
        if (step >= executionPath.length - 1) {
          window.clearInterval(timer);
          return step;
        }
        return step + 1;
      });
    }, 650);
    return () => window.clearInterval(timer);
  }, [executionPath]);

  const executionEdgeIds = useMemo(() => {
    if (executionStep < 1) return new Set<string>();
    const ids = new Set<string>();
    for (let index = 0; index < executionStep; index += 1) {
      const source = executionPath[index];
      const target = executionPath[index + 1];
      const match = initialEdges.find((edge) => edge.source === source && edge.target === target);
      if (match) ids.add(match.id);
    }
    return ids;
  }, [executionPath, executionStep]);

  const executionNodeIds = useMemo(
    () => new Set(executionPath.slice(0, Math.max(0, executionStep + 1))),
    [executionPath, executionStep],
  );

  const nodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialNodes.map((node) => ({
      ...node,
      selected: node.id === selectedId,
      className: executionNodeIds.has(node.id) ? 'd3-kg-runtime-node' : undefined,
      hidden:
        (kind !== 'all' && node.data.kind !== kind) ||
        Boolean(needle && !`${node.data.label} ${node.data.description} ${kindLabel[node.data.kind]}`.toLowerCase().includes(needle)),
    }));
  }, [executionNodeIds, kind, query, selectedId]);

  const edges = useMemo(() => {
    const visibleIds = new Set(nodes.filter((node) => !node.hidden).map((node) => node.id));
    return initialEdges.map((edge) => {
      const active = edge.source === selectedId || edge.target === selectedId;
      const platformEdge = ['films', 'radio', 'analytics', 'security'].includes(edge.target);
      const executing = executionEdgeIds.has(edge.id);
      return {
      ...edge,
      className: [
        'd3-kg-edge',
        active ? 'd3-kg-edge--active' : '',
        platformEdge ? 'd3-kg-edge--platform' : '',
        executing ? 'd3-kg-edge--executing' : '',
      ].filter(Boolean).join(' '),
      animated: edge.source === 'hermes' || active || executing,
      hidden: !visibleIds.has(edge.source) || !visibleIds.has(edge.target),
      style: {
        stroke: executing ? '#fef3c7' : active ? '#fde68a' : platformEdge ? '#fb923c' : '#78716c',
        strokeWidth: executing ? 3.2 : active ? 2.4 : platformEdge ? 1.7 : 1.3,
        opacity: executing ? 1 : active ? 0.98 : platformEdge ? 0.62 : 0.42,
      },
    };
    });
  }, [executionEdgeIds, nodes, selectedId]);

  const recordAction = (action: string) => {
    setActivity((items) => [`${action}: ${selected.data.label}`, ...items].slice(0, 5));
  };

  const startExecutionPreview = () => {
    const paths: Record<string, string[]> = {
      intent: ['intent'],
      hermes: ['intent', 'hermes'],
      agents: ['intent', 'hermes', 'agents'],
      knowledge: ['intent', 'hermes', 'knowledge'],
      tools: ['intent', 'hermes', 'tools'],
      workflow: ['intent', 'hermes', 'agents', 'workflow'],
      films: ['intent', 'hermes', 'agents', 'workflow', 'films'],
      radio: ['intent', 'hermes', 'agents', 'workflow', 'radio'],
      security: ['intent', 'hermes', 'tools', 'security'],
      analytics: ['intent', 'hermes', 'knowledge', 'workflow', 'analytics'],
    };
    const targetPath = paths[selected.id] ?? ['intent', 'hermes'];
    setExecutionPath(targetPath);
    setActivity((items) => [`Execution trace started: ${targetPath.join(' → ')}`, ...items].slice(0, 5));
  };

  const liveCorrelation = extractCorrelation(liveEvent?.payload ?? null);
  const liveTaskMatchesEvent = Boolean(liveTask && liveEvent?.task_id && liveTask.id === liveEvent.task_id);
  const totalRunTokens = runs.reduce((sum, run) => sum + (run.tokens_used ?? 0), 0);
  const totalRunCost = runs.reduce((sum, run) => sum + Number(run.cost_usd ?? 0), 0);
  const totalRunDuration = runs.reduce((sum, run) => sum + (run.duration_ms ?? 0), 0);
  const latestRun = runs[0] ?? null;
  const toolSignals = Array.from(new Set(
    taskLogs.flatMap((log) => {
      const data = log.data ?? {};
      const structured = [data.tool, data.tool_name, data.mcp, data.connector]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
      const eventFallback = /tool|mcp|connector/i.test(log.event) ? [log.event] : [];
      return [...structured, ...eventFallback];
    }),
  )).slice(0, 8);
  const proposalRuntimeDiff = (item: AdaptiveProposal): Record<string, unknown> => {
    if (item.category === 'concurrency') {
      return { scope: 'worker-runtime', target: item.target, env: 'HERMES_MAX_CONCURRENT_TASKS', operation: 'canary_reduce_percent', percent: 25 };
    }
    if (item.category === 'routing') {
      return { scope: 'router', target: item.target, operation: 'canary_fallback', traffic_percent: 10 };
    }
    if (item.category === 'agent') {
      return { scope: 'agent-profile', target: item.target, operation: 'evaluation_canary', traffic_percent: 10 };
    }
    if (item.category === 'tool') {
      return { scope: 'tool-policy', target: item.target, operation: 'read_only_fallback_canary' };
    }
    return { scope: 'workflow-policy', target: item.target, operation: 'preflight_gate' };
  };

  const refreshAdaptiveChangeRequests = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch(`${API_BASE_URL}/api/hermes/adaptive-change-requests?limit=30`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const rows = await response.json().catch(() => []);
      if (!response.ok) throw new Error(typeof rows?.detail === 'string' ? rows.detail : 'Change request load failed');
      const typedRows = (Array.isArray(rows) ? rows : []) as AdaptiveChangeRequestRow[];
      setChangeRequests(typedRows);

      if (typedRows.length) {
        const ids = typedRows.map((row) => row.id);
        const auditRes = await supabase
          .from('hermes_adaptive_change_audit')
          .select('id,change_request_id,event_type,event_data,created_at')
          .in('change_request_id', ids)
          .order('created_at', { ascending: false })
          .limit(100);
        if (!auditRes.error) setChangeAudit((auditRes.data ?? []) as unknown as AdaptiveAuditRow[]);
      } else {
        setChangeAudit([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Change request load failed';
      setActivity((items) => [`Governance ledger error: ${message}`, ...items].slice(0, 5));
    }
  };

  useEffect(() => {
    refreshAdaptiveChangeRequests();
  }, []);

  const stageAdaptiveProposal = async (item: AdaptiveProposal) => {
    setChangeBusy(item.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in is required to stage a governed change request.');
      const rollbackPlan = `Abort the canary and retain the current production ${item.category} policy for ${item.target}; do not promote the proposed change.`;
      const baselineRow = item.id === 'routing-unassigned'
        ? systemHealth.find((row) => row.label === 'Unassigned')
        : systemHealth.find((row) => row.label === item.target);
      if (!baselineRow || baselineRow.tasks < 1 || baselineRow.runs < 1) {
        throw new Error('A measured system-health baseline is required before staging this proposal.');
      }
      const baselineMetrics = {
        success_rate: Math.max(0, 1 - baselineRow.failed / baselineRow.tasks),
        error_rate: baselineRow.failed / baselineRow.tasks,
        latency_ms: baselineRow.duration_ms / baselineRow.runs,
        cost_usd: baselineRow.cost_usd / baselineRow.tasks,
      };
      const response = await fetch(`${API_BASE_URL}/api/hermes/adaptive-change-requests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: item.id,
          category: item.category,
          target: item.target,
          severity: item.severity,
          evidence: {
            reason: item.reason,
            system_health_updated_at: systemHealthUpdatedAt?.toISOString() ?? null,
            system_health: systemHealth,
            baseline_metrics: baselineMetrics,
          },
          proposed_change: proposalRuntimeDiff(item),
          guardrail: item.guardrail,
          rollback_plan: rollbackPlan,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : 'Change request staging failed');
      setActivity((items) => [`Governed review staged: ${item.target}`, ...items].slice(0, 5));
      await refreshAdaptiveChangeRequests();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Change request staging failed';
      setActivity((items) => [`Governed review blocked: ${message}`, ...items].slice(0, 5));
    } finally {
      setChangeBusy(null);
    }
  };

  const decideAdaptiveChange = async (requestId: string, decision: 'approved' | 'rejected') => {
    setChangeBusy(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in is required to review a change request.');
      const response = await fetch(`${API_BASE_URL}/api/hermes/adaptive-change-requests/${encodeURIComponent(requestId)}/decision`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, rationale: reviewNote.trim() || 'Operator review completed.' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : `Change request ${decision} failed`);
      setActivity((items) => [`Change request ${decision}: ${requestId}`, ...items].slice(0, 5));
      await refreshAdaptiveChangeRequests();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Change request review failed';
      setActivity((items) => [`Review blocked: ${message}`, ...items].slice(0, 5));
    } finally {
      setChangeBusy(null);
    }
  };

  const queueAdaptiveCanary = async (requestId: string) => {
    setChangeBusy(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in is required to queue a canary.');
      const response = await fetch(`${API_BASE_URL}/api/hermes/adaptive-change-requests/${encodeURIComponent(requestId)}/canary`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : 'Canary queue failed');
      setActivity((items) => [`Evaluation-only canary queued: ${payload.task_id ?? requestId}`, ...items].slice(0, 5));
      await refreshAdaptiveChangeRequests();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Canary queue failed';
      setActivity((items) => [`Canary blocked: ${message}`, ...items].slice(0, 5));
    } finally {
      setChangeBusy(null);
    }
  };

  const refreshPromotionCandidates = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch(`${API_BASE_URL}/api/hermes/adaptive-promotion-candidates?limit=30`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : 'Promotion candidate load failed');
      setPromotionCandidates((Array.isArray(payload) ? payload : []) as AdaptivePromotionCandidateRow[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Promotion candidate load failed';
      setActivity((items) => [`Promotion candidate error: ${message}`, ...items].slice(0, 5));
    }
  };

  useEffect(() => {
    refreshPromotionCandidates();
  }, []);

  const certifyAdaptiveCanary = async (requestId: string) => {
    setChangeBusy(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in is required to certify a canary.');
      const response = await fetch(`${API_BASE_URL}/api/hermes/adaptive-change-requests/${encodeURIComponent(requestId)}/certify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : 'Canary certification failed');
      setActivity((items) => [`Canary certification ${String(payload.decision ?? '').toUpperCase()}: ${requestId}`, ...items].slice(0, 5));
      await Promise.all([refreshAdaptiveChangeRequests(), refreshPromotionCandidates()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Canary certification failed';
      setActivity((items) => [`Certification blocked: ${message}`, ...items].slice(0, 5));
    } finally {
      setChangeBusy(null);
    }
  };

  const refreshAdaptiveRollouts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch(`${API_BASE_URL}/api/hermes/adaptive-rollouts?limit=30`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : 'Rollout load failed');
      setRollouts((Array.isArray(payload) ? payload : []) as AdaptiveRolloutRow[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rollout load failed';
      setActivity((items) => [`Rollout ledger error: ${message}`, ...items].slice(0, 5));
    }
  };

  useEffect(() => {
    refreshAdaptiveRollouts();
  }, []);

  const decidePromotionCandidate = async (candidateId: string, decision: 'approved' | 'rejected') => {
    setChangeBusy(candidateId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in is required to review promotion candidates.');
      const response = await fetch(`${API_BASE_URL}/api/hermes/adaptive-promotion-candidates/${encodeURIComponent(candidateId)}/decision`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, rationale: reviewNote.trim() || 'Promotion evidence reviewed.' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : 'Promotion review failed');
      setActivity((items) => [`Promotion ${decision}: ${candidateId}`, ...items].slice(0, 5));
      await refreshPromotionCandidates();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Promotion review failed';
      setActivity((items) => [`Promotion review blocked: ${message}`, ...items].slice(0, 5));
    } finally {
      setChangeBusy(null);
    }
  };

  const validatePromotionRollout = async (candidateId: string, environment: 'staging' | 'production') => {
    setChangeBusy(candidateId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in is required to validate rollout.');
      if (environment === 'production' && productionAuthorization.trim().length < 16) {
        throw new Error('Enter an explicit production authorization token/passphrase (16+ characters).');
      }
      const response = await fetch(`${API_BASE_URL}/api/hermes/adaptive-promotion-candidates/${encodeURIComponent(candidateId)}/rollout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment,
          production_authorization: environment === 'production' ? productionAuthorization : null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : 'Rollout validation failed');
      setActivity((items) => [`${environment} rollout validated; runtime unchanged: ${candidateId}`, ...items].slice(0, 5));
      await refreshAdaptiveRollouts();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rollout validation failed';
      setActivity((items) => [`Rollout blocked: ${message}`, ...items].slice(0, 5));
    } finally {
      setChangeBusy(null);
    }
  };

  const adaptiveProposals = useMemo<AdaptiveProposal[]>(() => {
    const proposals: AdaptiveProposal[] = [];
    if (systemHealthLoading || systemHealthError || !systemHealthUpdatedAt) {
      return [{
        id: 'health-evidence-unavailable',
        category: 'workflow',
        target: 'Hermes telemetry',
        reason: systemHealthError
          ? \`System-health evidence is unavailable: \${systemHealthError}\`
          : 'System-health evidence has not completed loading yet.',
        proposal: 'Do not change routing, concurrency, agent, tool, or workflow policy until a measured health snapshot is available.',
        guardrail: 'Missing telemetry is not healthy telemetry; no canary or production change should be staged from this state.',
        severity: 'warning',
      }];
    }


    for (const row of systemHealth) {
      const failureRate = row.tasks ? row.failed / row.tasks : 0;
      const avgRunMs = row.runs ? row.duration_ms / row.runs : 0;
      const costPerTask = row.run_tasks ? row.cost_usd / row.run_tasks : 0;
      const agent = row.label;

      if (agent === 'Unassigned' && row.tasks > 0) {
        proposals.push({
          id: 'routing-unassigned',
          category: 'routing',
          target: 'Hermes router',
          reason: `${row.tasks} recent executing/terminal task(s) are unassigned.`,
          proposal: 'Require an explicit agent assignment before dispatch for non-system tasks; send unresolved assignments to MANUAL_REVIEW instead of silently executing.',
          guardrail: 'Do not change existing in-flight tasks; apply only after an operator approves a routing-policy update.',
          severity: row.tasks >= 5 ? 'critical' : 'warning',
        });
        continue;
      }

      if (failureRate >= 0.25 && row.tasks >= 4) {
        proposals.push({
          id: `route-${row.key}`,
          category: 'routing',
          target: agent,
          reason: `${(failureRate * 100).toFixed(0)}% failure rate across ${row.tasks} recent task(s).`,
          proposal: 'Place new non-critical assignments behind a 10% canary route to a capability-compatible fallback and compare success/error signatures before broader rerouting.',
          guardrail: 'Fallback compatibility must be validated against the Hermes agent registry; safety/approval work must remain with GUARDIAN.',
          severity: failureRate >= 0.5 ? 'critical' : 'warning',
        });
      }

      if (row.retries >= 3) {
        proposals.push({
          id: `workflow-${row.key}`,
          category: 'workflow',
          target: agent,
          reason: `${row.retries} retries are recorded in the recent task window.`,
          proposal: 'Insert a deterministic preflight validation step before this agent and stop automatic retry after one unchanged failure signature.',
          guardrail: 'Preflight may reject or pause work, but must not bypass human approval or mutate protected task inputs.',
          severity: row.retries >= 6 ? 'critical' : 'warning',
        });
      }

      if (avgRunMs >= 30_000 && row.runs >= 3) {
        proposals.push({
          id: `concurrency-${row.key}`,
          category: 'concurrency',
          target: agent,
          reason: `Average loaded run duration is ${(avgRunMs / 1000).toFixed(1)}s across ${row.runs} run(s).`,
          proposal: 'Canary a 25% lower worker lease/concurrency target for this workload class and compare queue depth, completion time, and failure rate before changing HERMES_MAX_CONCURRENT_TASKS.',
          guardrail: 'No environment variable changes are applied from this screen; deployment/config approval remains required.',
          severity: avgRunMs >= 60_000 ? 'critical' : 'warning',
        });
      }

      if (costPerTask >= 0.05 && row.run_tasks >= 3) {
        proposals.push({
          id: `cost-${row.key}`,
          category: 'agent',
          target: agent,
          reason: `Loaded run cost averages ${costPerTask.toFixed(3)} across ${row.run_tasks} distinct recent executed task(s).`,
          proposal: 'Run a 10% evaluation canary using a lower-cost compatible model/tool profile, preserving the same task inputs and acceptance criteria for side-by-side comparison.',
          guardrail: 'Do not downgrade safety, approval, or accuracy requirements; promote only after measured equivalence.',
          severity: costPerTask >= 0.15 ? 'critical' : 'warning',
        });
      }
    }

    if (liveTask && /tool|mcp|connector|integration/i.test(`${liveTask.kind} ${liveTask.title ?? ''}`)) {
      proposals.push({
        id: 'tool-fallback-active',
        category: 'tool',
        target: liveTask.title ?? liveTask.kind,
        reason: toolSignals.length
          ? `Active task exposes ${toolSignals.length} tool/MCP attribution signal(s).`
          : 'No structured tool/MCP attribution appears in the newest 60 loaded logs for this tool-oriented task.',
        proposal: toolSignals.length
          ? 'Define an ordered fallback chain for the attributed connector/tool and test failover with a read-only canary before allowing mutation-capable fallback.'
          : 'Add structured tool attribution first, then define a fail-closed fallback chain so Hermes can distinguish provider failure from missing instrumentation.',
        guardrail: 'Fallbacks must inherit the original tool permissions, approval mode, and destructive-action policy.',
        severity: toolSignals.length ? 'info' : 'warning',
      });
    }

    if (!proposals.length) {
      proposals.push({
        id: 'stable-system',
        category: 'workflow',
        target: 'Hermes',
        reason: 'No aggregate signal currently crosses the adaptive recommendation thresholds.',
        proposal: 'Keep the current routing topology and continue collecting task/run evidence before changing worker, agent, or tool policy.',
        guardrail: 'Absence of a recommendation is not a production certification; deployment smoke tests remain separate.',
        severity: 'info',
      });
    }

    return proposals.slice(0, 10);
  }, [liveTask, systemHealth, systemHealthError, systemHealthLoading, systemHealthUpdatedAt, toolSignals]);

  const graphFindings = useMemo<GraphFinding[]>(() => {
    if (!liveTask) return [];
    const findings: GraphFinding[] = [];
    const failedRuns = runs.filter((run) => run.status.toUpperCase() === 'FAILED');
    const latestRunStatus = (runs[0]?.status ?? '').toUpperCase();
    const activeFailure = liveTask.status.toUpperCase() === 'FAILED' || latestRunStatus === 'FAILED';
    const failedChildren = childTasks.filter((task) => task.status.toUpperCase() === 'FAILED');
    const longestRun = runs.reduce((max, run) => Math.max(max, run.duration_ms ?? 0), 0);
    const retryCount = liveTask.retry_count ?? Math.max(0, runs.length - 1);
    const toolExpected = /tool|mcp|connector|integration/i.test(`${liveTask.kind} ${liveTask.title ?? ''}`);

    if (activeFailure) {
      findings.push({
        id: 'failure',
        severity: 'critical',
        label: 'Active execution failure',
        evidence: `Current task/latest run is failed; ${failedRuns.length || 1} failed run signal(s) exist in the loaded ledger.`,
        recommendation: 'Inspect the latest failing run and error detail before retrying; preserve the same correlation trail for comparison.',
      });
    } else if (failedRuns.length > 0) {
      findings.push({
        id: 'historical-failure',
        severity: 'info',
        label: 'Recovered after earlier failure',
        evidence: `${failedRuns.length} historical failed run(s) are present, but the current task/latest run is no longer failed.`,
        recommendation: 'Treat these as recovery history; compare the successful attempt with the failed attempts before changing policy.',
      });
    }

    if (failedChildren.length >= 2) {
      findings.push({
        id: 'failure-cluster',
        severity: 'critical',
        label: 'Failed child-task cluster',
        evidence: `${failedChildren.length} child tasks in this lineage are failed.`,
        recommendation: 'Check for a shared upstream dependency, agent, tool, or policy boundary before retrying children independently.',
      });
    }

    if (retryCount >= 2 || runs.length >= 3) {
      findings.push({
        id: 'retry-loop',
        severity: 'warning',
        label: 'Repeated execution attempts',
        evidence: `${Math.max(retryCount, runs.length - 1)} retry/extra-attempt signal(s) detected.`,
        recommendation: 'Compare run errors and inputs across attempts; stop blind retries if the failure signature is unchanged.',
      });
    }

    if (longestRun >= 30_000 || totalRunDuration >= 60_000) {
      findings.push({
        id: 'slow',
        severity: 'warning',
        label: 'Slow execution path',
        evidence: `Longest run ${(longestRun / 1000).toFixed(1)}s; cumulative runtime ${(totalRunDuration / 1000).toFixed(1)}s.`,
        recommendation: 'Inspect the slowest agent/tool boundary and consider splitting long work or moving it to an asynchronous worker.',
      });
    }

    if (totalRunCost >= 0.10) {
      findings.push({
        id: 'cost',
        severity: 'warning',
        label: 'Elevated execution cost',
        evidence: `Observed run ledger cost is ${totalRunCost.toFixed(4)} for the active task.`,
        recommendation: 'Review model/tool choice and repeated attempts; compare cost against successful runs of the same task kind.',
      });
    }

    if ((liveTask.depth ?? 0) > 0 && !liveTask.parent_task_id) {
      findings.push({
        id: 'orphan',
        severity: 'warning',
        label: 'Possible orphaned task',
        evidence: `Task depth is ${liveTask.depth} but no parent_task_id is present.`,
        recommendation: 'Verify lineage persistence before relying on ancestry-based monitoring or cancellation.',
      });
    }

    if (toolExpected && toolSignals.length === 0) {
      findings.push({
        id: 'missing-tool-attribution',
        severity: 'warning',
        label: 'Expected tool attribution is missing',
        evidence: 'Task naming suggests a tool/MCP/connector path, but no structured attribution appears in the newest 60 task logs loaded in this view.',
        recommendation: 'Check the full task log history before adding instrumentation; if attribution is truly absent, emit tool_name or connector data at the execution boundary.',
      });
    }

    if (!findings.length) {
      findings.push({
        id: 'no-anomaly',
        severity: 'info',
        label: 'No active heuristic anomaly',
        evidence: 'The current task and loaded lineage do not cross the configured warning thresholds.',
        recommendation: 'Continue monitoring; these findings are advisory and scoped to the records currently loaded in this view.',
      });
    }
    return findings;
  }, [childTasks, liveTask, runs, toolSignals, totalRunCost, totalRunDuration]);

  return (
    <div className="min-h-screen bg-[#080806] text-stone-100">
      <div className="border-b border-[#2d2c28] bg-[#0c0c0a] shadow-[0_6px_24px_rgba(0,0,0,0.28)]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-amber-200/70">D3VONN.IO Intelligence Fabric</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Operational Knowledge Graph</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="border border-[#4b4633] bg-[#15140f] px-3 py-1.5 text-xs text-amber-100/75">
              Governed UI model · adapters attach to live data
            </span>
            <Link to="/command-center" className="border border-[#34332f] bg-[#0c0c0a] px-4 py-2 text-sm font-semibold text-stone-200 transition hover:border-amber-100/30 hover:text-white">
              Command Center
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <section className="overflow-hidden border border-[#2d2c28] bg-[#0b0b09] shadow-[0_16px_40px_rgba(0,0,0,0.32)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#2d2c28] bg-[#10100d] p-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.02)]">
            <label className="flex min-w-[260px] flex-1 items-center gap-2 border border-[#34332f] bg-[#11110f] px-3 py-2">
              <Search className="h-4 w-4 text-stone-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search agents, tools, memory, products..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-stone-600"
              />
            </label>
            <select
              aria-label="Filter knowledge graph by node type"
              value={kind}
              onChange={(event) => setKind(event.target.value as NodeKind | 'all')}
              className="border border-[#34332f] bg-[#11110f] px-3 py-2 text-sm text-stone-200 outline-none"
            >
              <option value="all">All node types</option>
              {Object.entries(kindLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="h-[680px]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              fitView
              fitViewOptions={{ padding: 0.16 }}
              minZoom={0.45}
              maxZoom={1.45}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#2f2e29" gap={24} size={1} />
              <Controls className="!border-[#34332f] !bg-[#11110f] !text-stone-100 !shadow-lg" />
              <MiniMap
                pannable
                zoomable
                nodeColor="#a8a29e"
                maskColor="rgba(8,8,6,0.72)"
                className="!border !border-[#34332f] !bg-[#0e0e0c] !shadow-lg"
              />
            </ReactFlow>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="border border-[#4b4633] bg-[#15140f] p-5 shadow-[inset_3px_0_0_#fcd34d,0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-amber-200" />
              <h2 className="text-sm font-bold text-white">Voice command layer</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-400">
              Speak naturally to Hermes. Voice and clicks share the same governed execution boundary.
            </p>
            <div className="mt-4 space-y-2 text-[11px] text-stone-400">
              {[
                '“Hermes, show infrastructure.”',
                '“Trace HNF Radio.”',
                '“Open AI Films.”',
                '“Monitor this agent.”',
                '“Find a bridge between Academy and AI Films.”',
              ].map((example) => (
                <div key={example} className="border border-[#2d2c28] bg-[#0c0c0a] px-3 py-2">
                  {example}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#2d2c28] pt-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Production voice</p>
                <p className="mt-1 text-xs text-stone-300">Vapi orchestration · ElevenLabs voice · Hermes tools</p>
              </div>
              <ConversationalVoiceControls context={voiceContext} />
            </div>
          </section>
          <section className="border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">Selected node</p>
                <h2 className="mt-1 text-xl font-black text-white">{selected.data.label}</h2>
              </div>
              <span className="border border-emerald-300/20 bg-[#101713] px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                {stateLabel[selected.data.state]}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-stone-400">{selected.data.description}</p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => recordAction('Trace requested')} className="flex items-center justify-center gap-2 border border-[#34332f] bg-[#11110f] px-3 py-2.5 text-xs font-semibold hover:border-amber-100/30">
                <Eye className="h-4 w-4" /> Trace
              </button>
              <button onClick={startExecutionPreview} className="flex items-center justify-center gap-2 border border-[#34332f] bg-[#11110f] px-3 py-2.5 text-xs font-semibold hover:border-amber-100/30">
                <Play className="h-4 w-4" /> Run trace
              </button>
              <button onClick={() => recordAction('Monitor staged')} className="flex items-center justify-center gap-2 border border-[#34332f] bg-[#11110f] px-3 py-2.5 text-xs font-semibold hover:border-amber-100/30">
                <Activity className="h-4 w-4" /> Monitor
              </button>
              <button onClick={() => recordAction('Bridge analysis staged')} className="flex items-center justify-center gap-2 border border-[#34332f] bg-[#11110f] px-3 py-2.5 text-xs font-semibold hover:border-amber-100/30">
                <Zap className="h-4 w-4" /> Bridge
              </button>
            </div>

            <Link to={selected.data.route} className="mt-3 flex items-center justify-between bg-amber-200 px-3 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-50">
              Open canonical surface <ChevronRight className="h-4 w-4" />
            </Link>
          </section>

          <section className="border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-amber-200" />
              <h2 className="text-sm font-bold text-white">Blind-spot bridges</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Suggested cross-system connections. These are proposals, not automatic mutations.
            </p>
            <div className="mt-4 space-y-3">
              {bridgeIdeas.map((idea) => (
                <button
                  key={idea.id}
                  onClick={() => setActivity((items) => [`Bridge inspected: ${idea.title}`, ...items].slice(0, 5))}
                  className="w-full border border-[#2f2e2a] bg-[#0c0c0a] p-3 text-left transition hover:border-amber-100/25 hover:bg-amber-100/[0.035]"
                >
                  <p className="text-xs font-bold text-stone-100">{idea.title}</p>
                  <p className="mt-1.5 text-[11px] leading-5 text-stone-500">{idea.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {idea.path.map((step) => (
                      <span key={step} className="border border-[#2d2c28] bg-[#141411] px-1.5 py-1 text-[9px] font-medium text-stone-400">{step}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-amber-200" />
              <h2 className="text-sm font-bold text-white">Execution propagation</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Authenticated Supabase Realtime subscription to Hermes tasks and events. Manual Run trace remains available as a deterministic fallback.
            </p>
            <div className="mt-3 flex items-center justify-between border border-[#2d2c28] bg-[#0c0c0a] px-3 py-2 text-[10px]">
              <span className="flex items-center gap-2 font-semibold uppercase tracking-[0.16em] text-stone-400">
                <span className={`h-2 w-2 rounded-full ${realtimeState === 'live' ? 'bg-emerald-300' : realtimeState === 'error' ? 'bg-red-300' : 'animate-pulse bg-amber-200'}`} />
                Hermes realtime · {realtimeState}
              </span>
              <span className="max-w-[190px] truncate text-stone-500" title={lastLiveEvent}>{lastLiveEvent}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(executionPath.length ? executionPath : ['intent', 'hermes', 'agents', 'workflow', 'platform']).map((id, index) => {
                const node = initialNodes.find((item) => item.id === id);
                const active = executionPath.length > 0 && index <= executionStep;
                return (
                  <span
                    key={`${id}-${index}`}
                    className={`border px-2 py-1 text-[10px] font-semibold transition ${active ? 'border-amber-300/50 bg-amber-200/10 text-amber-100' : 'border-[#2d2c28] bg-[#0c0c0a] text-stone-500'}`}
                  >
                    {node?.data.label ?? id}
                  </span>
                );
              })}
            </div>
          </section>

          <section className="border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-200" />
                <h2 className="text-sm font-bold text-white">Live execution inspector</h2>
              </div>
              <span className={`border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${liveTask?.status?.toUpperCase() === 'FAILED' ? 'border-red-300/30 bg-red-300/10 text-red-200' : liveTask?.status?.toUpperCase() === 'COMPLETED' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/30 bg-amber-300/10 text-amber-100'}`}>
                {liveTask?.status ?? 'waiting'}
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-[11px]">
              <div className="grid grid-cols-[92px_1fr] gap-3 border-b border-[#25241f] pb-2">
                <span className="text-stone-600">Task ID</span>
                <span className="truncate font-mono text-stone-300" title={liveTask?.id ?? liveEvent?.task_id ?? '—'}>{liveTask?.id ?? liveEvent?.task_id ?? '—'}</span>
              </div>
              <div className="grid grid-cols-[92px_1fr] gap-3 border-b border-[#25241f] pb-2">
                <span className="text-stone-600">Kind</span>
                <span className="text-stone-300">{liveTask?.kind ?? '—'}</span>
              </div>
              <div className="grid grid-cols-[92px_1fr] gap-3 border-b border-[#25241f] pb-2">
                <span className="text-stone-600">Title</span>
                <span className="truncate text-stone-300" title={liveTask?.title ?? '—'}>{liveTask?.title ?? '—'}</span>
              </div>
              <div className="grid grid-cols-[92px_1fr] gap-3 border-b border-[#25241f] pb-2">
                <span className="text-stone-600">Event</span>
                <span className="text-stone-300">{liveEvent?.event_type ?? '—'}</span>
              </div>
              <div className="grid grid-cols-[92px_1fr] gap-3 border-b border-[#25241f] pb-2">
                <span className="text-stone-600">Correlation</span>
                <span className="truncate font-mono text-stone-300" title={liveCorrelation ?? '—'}>{liveCorrelation ?? '—'}</span>
              </div>
              <div className="grid grid-cols-[92px_1fr] gap-3 border-b border-[#25241f] pb-2">
                <span className="text-stone-600">Duration</span>
                <span className="text-stone-300">{formatDuration(liveTask)}</span>
              </div>
              <div className="grid grid-cols-[92px_1fr] gap-3 border-b border-[#25241f] pb-2">
                <span className="text-stone-600">Depth</span>
                <span className="text-stone-300">{liveTask?.depth ?? '—'}</span>
              </div>
              <div className="grid grid-cols-[92px_1fr] gap-3 border-b border-[#25241f] pb-2">
                <span className="text-stone-600">Linkage</span>
                <span className={liveTaskMatchesEvent ? 'text-emerald-200' : 'text-stone-500'}>
                  {liveTaskMatchesEvent ? 'Task ↔ event matched' : liveEvent?.task_id ? 'Awaiting matching task update' : 'Event has no task binding'}
                </span>
              </div>
              {liveTask?.error_message && (
                <div className="border border-red-300/20 bg-red-300/[0.04] p-2 text-red-200">
                  {liveTask.error_message}
                </div>
              )}
            </div>

            {liveEvent?.payload && (
              <details className="mt-3 border border-[#25241f] bg-[#090907] p-3">
                <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Event payload</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-5 text-stone-500">{JSON.stringify(liveEvent.payload, null, 2)}</pre>
              </details>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button disabled={!liveTask || actionBusy !== null} onClick={() => mutateLiveTask('pause')} className="border border-[#34332f] bg-[#0c0c0a] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-300 disabled:cursor-not-allowed disabled:opacity-40">Pause</button>
              <button disabled={!liveTask || actionBusy !== null} onClick={() => mutateLiveTask('resume')} className="border border-[#34332f] bg-[#0c0c0a] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-300 disabled:cursor-not-allowed disabled:opacity-40">Resume</button>
              <button disabled={!liveTask || actionBusy !== null} onClick={() => mutateLiveTask('retry')} className="border border-[#34332f] bg-[#0c0c0a] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-300 disabled:cursor-not-allowed disabled:opacity-40">Retry</button>
              <button disabled={!liveTask || actionBusy !== null} onClick={() => mutateLiveTask('cancel')} className="border border-red-300/20 bg-red-300/[0.035] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-red-200 disabled:cursor-not-allowed disabled:opacity-40">Cancel</button>
            </div>

            {pendingInterrupt && (
              <div className="mt-3 border border-orange-300/20 bg-orange-300/[0.035] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-200">Approval required</p>
                <p className="mt-1 text-[11px] leading-5 text-stone-400">{pendingInterrupt.prompt}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button disabled={actionBusy !== null} onClick={() => resolveLiveInterrupt('approved')} className="border border-emerald-300/25 bg-emerald-300/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200 disabled:opacity-40">Approve</button>
                  <button disabled={actionBusy !== null} onClick={() => resolveLiveInterrupt('rejected')} className="border border-red-300/25 bg-red-300/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-red-200 disabled:opacity-40">Reject</button>
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-[#25241f] pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Execution timeline</p>
                <button onClick={() => refreshTaskTimeline(liveTask)} disabled={!liveTask || timelineLoading} className="text-[10px] font-semibold text-amber-100/70 disabled:opacity-40">
                  {timelineLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
                {timeline.length === 0 ? (
                  <div className="border border-[#25241f] bg-[#090907] px-3 py-2 text-[10px] text-stone-600">
                    {timelineError ? `Timeline unavailable: ${timelineError}` : liveTask ? 'No task-linked timeline rows available yet.' : 'Waiting for a live Hermes task.'}
                  </div>
                ) : timeline.map((item) => (
                  <div key={item.id} className="border border-[#25241f] bg-[#090907] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold text-stone-300">{item.title}</span>
                      <span className="text-[9px] uppercase tracking-[0.12em] text-stone-600">{item.kind}{item.status ? ` · ${item.status}` : ''}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 break-all text-[10px] leading-4 text-stone-600">{item.detail}</p>
                    <p className="mt-1 text-[9px] text-stone-700">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-200" />
                <h2 className="text-sm font-bold text-white">Adaptive recommendations</h2>
              </div>
              <span className="border border-[#34332f] bg-[#0c0c0a] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-stone-500">approval-gated</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Evidence-derived proposals for routing, agent/model selection, tool fallback, concurrency, and workflow structure. Nothing here changes runtime state automatically.
            </p>

            <div className="mt-4 space-y-2">
              {adaptiveProposals.map((item) => (
                <div key={item.id} className="border border-[#2d2c28] bg-[#090907] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-stone-200">{item.target}</p>
                      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-stone-600">{item.category}</p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-[0.12em] ${item.severity === 'critical' ? 'text-red-200' : item.severity === 'warning' ? 'text-amber-200' : 'text-stone-600'}`}>
                      {item.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-stone-500">{item.reason}</p>
                  <p className="mt-2 text-[10px] leading-4 text-stone-300">
                    <span className="font-bold text-stone-500">Proposed change:</span> {item.proposal}
                  </p>
                  <p className="mt-2 border-l border-[#34332f] pl-2 text-[9px] leading-4 text-stone-600">
                    <span className="font-bold">Guardrail:</span> {item.guardrail}
                  </p>
                  <button
                    onClick={() => stageAdaptiveProposal(item)}
                    disabled={changeBusy !== null || item.id === 'stable-system'}
                    className="mt-3 w-full border border-amber-300/20 bg-amber-300/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Stage governed review
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 border border-[#25241f] bg-[#0c0c0a] px-3 py-2 text-[9px] leading-4 text-stone-600">
              Recommendations are staged only. Applying routing, model, worker-concurrency, tool-fallback, or workflow-policy changes requires a separate governed action and production validation.
            </div>
          </section>

          <section className="border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-200" />
                <h2 className="text-sm font-bold text-white">Governed change requests</h2>
              </div>
              <button onClick={refreshAdaptiveChangeRequests} className="text-[10px] font-semibold text-amber-100/70">Refresh</button>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Immutable evidence snapshot → risk classification → human decision → evaluation-only canary. Approval never equals production apply.
            </p>

            <textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              className="mt-3 min-h-16 w-full border border-[#2d2c28] bg-[#090907] px-3 py-2 text-[10px] text-stone-300 outline-none focus:border-amber-200/30"
              aria-label="Change request review rationale"
              placeholder="Reviewer rationale"
            />

            <div className="mt-3 space-y-2">
              {changeRequests.map((request) => {
                const auditRows = changeAudit.filter((item) => item.change_request_id === request.id).slice(0, 4);
                return (
                  <div key={request.id} className="border border-[#2d2c28] bg-[#090907] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold text-stone-200">{request.target}</p>
                        <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-stone-600">{request.category} · risk {request.risk_classification}</p>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-amber-200">{request.status}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-[86px_1fr] gap-2 text-[9px]">
                      <span className="text-stone-600">Evidence</span>
                      <span className="truncate font-mono text-stone-400" title={request.evidence_hash}>{request.evidence_hash.slice(0, 16)}…</span>
                      <span className="text-stone-600">Diff</span>
                      <span className="break-all text-stone-400">{JSON.stringify(request.proposed_change)}</span>
                      <span className="text-stone-600">Rollback</span>
                      <span className="text-stone-400">{request.rollback_plan}</span>
                    </div>

                    {request.status === 'pending_review' && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button disabled={changeBusy !== null} onClick={() => decideAdaptiveChange(request.id, 'approved')} className="border border-emerald-300/25 bg-emerald-300/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200 disabled:opacity-40">Approve</button>
                        <button disabled={changeBusy !== null} onClick={() => decideAdaptiveChange(request.id, 'rejected')} className="border border-red-300/25 bg-red-300/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-red-200 disabled:opacity-40">Reject</button>
                      </div>
                    )}

                    {request.status === 'approved' && (
                      <button disabled={changeBusy !== null} onClick={() => queueAdaptiveCanary(request.id)} className="mt-3 w-full border border-amber-300/25 bg-amber-300/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100 disabled:opacity-40">
                        Queue evaluation-only canary
                      </button>
                    )}

                    {request.canary_task_id && (
                      <button onClick={() => setLiveTask({ id: request.canary_task_id!, kind: 'adaptive.canary', title: `Canary: ${request.target}`, status: 'PENDING' })} className="mt-2 w-full border border-[#34332f] bg-[#0c0c0a] px-3 py-2 text-[10px] text-stone-400">
                        Inspect canary task · {request.canary_task_id.slice(0, 8)}
                      </button>
                    )}

                    {request.status === 'canary_queued' && (
                      <div className="mt-3 border border-[#25241f] bg-[#0c0c0a] p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-stone-500">Canary certification</p>
                        <p className="mt-2 text-[10px] leading-4 text-stone-500">
                          Certification is bound to the frozen baseline evidence and the linked Hermes canary task&apos;s persisted metrics. The task must be COMPLETED and include measured cost evidence.
                        </p>
                        <button disabled={changeBusy !== null} onClick={() => certifyAdaptiveCanary(request.id)} className="mt-3 w-full border border-emerald-300/25 bg-emerald-300/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200 disabled:opacity-40">
                          Certify completed canary
                        </button>
                        <p className="mt-2 text-[9px] leading-4 text-stone-600">PASS permits at most 2pp success/error regression and 20% latency/cost regression. Incomplete or unmeasured canaries fail closed.</p>
                      </div>
                    )}

                    {auditRows.length > 0 && (
                      <details className="mt-3 border-t border-[#25241f] pt-2">
                        <summary className="cursor-pointer text-[9px] font-bold uppercase tracking-[0.12em] text-stone-600">Audit trail</summary>
                        <div className="mt-2 space-y-1">
                          {auditRows.map((audit) => (
                            <p key={audit.id} className="text-[9px] text-stone-600">
                              {new Date(audit.created_at).toLocaleString()} · {audit.event_type}
                            </p>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
              {!changeRequests.length && (
                <div className="border border-[#25241f] bg-[#090907] px-3 py-2 text-[10px] text-stone-600">
                  No governed adaptive change requests staged yet.
                </div>
              )}
            </div>
          </section>

          <section className="border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-200" />
                <h2 className="text-sm font-bold text-white">Canary certification & promotion candidates</h2>
              </div>
              <button onClick={refreshPromotionCandidates} className="text-[10px] font-semibold text-amber-100/70">Refresh</button>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Only passing canary certifications create a promotion candidate. Failed canaries explicitly retain current production policy.
            </p>
            <div className="mt-4 space-y-2">
              {promotionCandidates.map((item) => (
                <div key={item.id} className="border border-[#2d2c28] bg-[#090907] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] text-stone-300">{item.id.slice(0, 8)}</span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-200">{item.status}</span>
                  </div>
                  <p className="mt-2 break-all text-[10px] text-stone-500">{JSON.stringify(item.proposed_change)}</p>
                  <p className="mt-2 truncate font-mono text-[9px] text-stone-700" title={item.evidence_hash}>evidence {item.evidence_hash}</p>
                  {item.status === 'pending_promotion_review' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button disabled={changeBusy !== null} onClick={() => decidePromotionCandidate(item.id, 'approved')} className="border border-emerald-300/25 bg-emerald-300/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200 disabled:opacity-40">Approve promotion</button>
                      <button disabled={changeBusy !== null} onClick={() => decidePromotionCandidate(item.id, 'rejected')} className="border border-red-300/25 bg-red-300/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-red-200 disabled:opacity-40">Reject</button>
                    </div>
                  )}
                  {item.status === 'approved' && (
                    <div className="mt-3 space-y-2">
                      <button disabled={changeBusy !== null} onClick={() => validatePromotionRollout(item.id, 'staging')} className="w-full border border-[#34332f] bg-[#0c0c0a] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-300 disabled:opacity-40">Validate staging rollout</button>
                      <input value={productionAuthorization} onChange={(e) => setProductionAuthorization(e.target.value)} type="password" placeholder="Production authorization (16+ chars)" className="w-full border border-[#2d2c28] bg-[#090907] px-3 py-2 text-[10px] text-stone-300" />
                      <button disabled={changeBusy !== null || productionAuthorization.trim().length < 16} onClick={() => validatePromotionRollout(item.id, 'production')} className="w-full border border-amber-300/25 bg-amber-300/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100 disabled:opacity-40">Validate production rollout</button>
                    </div>
                  )}
                </div>
              ))}
              {!promotionCandidates.length && <div className="border border-[#25241f] bg-[#090907] px-3 py-2 text-[10px] text-stone-600">No passing canary has produced a promotion candidate yet.</div>}
            </div>
            <div className="mt-4 border-t border-[#25241f] pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Validated rollout ledger</p>
                <button onClick={refreshAdaptiveRollouts} className="text-[10px] text-amber-100/70">Refresh</button>
              </div>
              <div className="mt-2 space-y-2">
                {rollouts.map((rollout) => (
                  <div key={rollout.id} className="border border-[#25241f] bg-[#090907] p-3 text-[9px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-stone-300">{rollout.id.slice(0, 8)}</span>
                      <span className="uppercase text-stone-500">{rollout.environment} · {rollout.status}</span>
                    </div>
                    <p className="mt-1 text-stone-600">runtime_changed={String(rollout.runtime_changed)} · rollback snapshot retained</p>
                  </div>
                ))}
                {!rollouts.length && <p className="text-[10px] text-stone-600">No validated rollouts yet.</p>}
              </div>
            </div>
          </section>

          <section className="border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-200" />
                <h2 className="text-sm font-bold text-white">System-wide graph health</h2>
              </div>
              <button onClick={refreshSystemHealth} disabled={systemHealthLoading} className="text-[10px] font-semibold text-amber-100/70 disabled:opacity-40">
                {systemHealthLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Aggregated pressure across the newest 250 Hermes tasks and 500 run records visible to this authenticated user.
            </p>

            <div className="mt-4 space-y-2">
              {systemHealth.map((row) => {
                const avgRunMs = row.runs ? row.duration_ms / row.runs : 0;
                const failureRate = row.tasks ? (row.failed / row.tasks) * 100 : 0;
                const pressure = row.failed * 5 + row.retries * 2 + row.duration_ms / 30_000 + row.cost_usd * 10;
                const level = pressure >= 15 ? 'critical' : pressure >= 6 ? 'warning' : 'normal';
                return (
                  <div key={row.key} className="border border-[#2d2c28] bg-[#090907] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[11px] font-bold text-stone-200">{row.label}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-[0.12em] ${level === 'critical' ? 'text-red-200' : level === 'warning' ? 'text-amber-200' : 'text-stone-600'}`}>
                        {level}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[9px]">
                      <span className="text-stone-500">Tasks <b className="text-stone-300">{row.tasks}</b></span>
                      <span className="text-stone-500">Fail <b className="text-stone-300">{failureRate.toFixed(0)}%</b></span>
                      <span className="text-stone-500">Retries <b className="text-stone-300">{row.retries}</b></span>
                      <span className="text-stone-500">Runs <b className="text-stone-300">{row.runs}</b></span>
                      <span className="text-stone-500">Avg <b className="text-stone-300">{avgRunMs ? `${(avgRunMs / 1000).toFixed(1)}s` : '—'}</b></span>
                      <span className="text-stone-500">Cost <b className="text-stone-300">${row.cost_usd.toFixed(3)}</b></span>
                    </div>
                  </div>
                );
              })}
              {!systemHealth.length && (
                <div className="border border-[#25241f] bg-[#090907] px-3 py-2 text-[10px] text-stone-600">
                  {systemHealthLoading ? 'Loading recent Hermes health…' : 'No recent system-health records available.'}
                </div>
              )}
            </div>

            <p className="mt-3 text-[9px] leading-4 text-stone-700">
              Pressure ranking is heuristic: failures ×5 + retries ×2 + runtime/30s + cost ×10. It is an operator signal, not an automated routing decision.
              {systemHealthUpdatedAt ? ` Updated ${systemHealthUpdatedAt.toLocaleTimeString()}.` : ''}
            </p>
          </section>

          <section className="border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-amber-200" />
                <h2 className="text-sm font-bold text-white">Operational intelligence</h2>
              </div>
              <span className="border border-[#34332f] bg-[#0c0c0a] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-stone-500">advisory only</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Deterministic heuristics over the active Hermes task, run ledger, and loaded lineage. Findings never mutate tasks or workflows automatically.
            </p>

            <div className="mt-4 space-y-2">
              {graphFindings.map((finding) => (
                <div
                  key={finding.id}
                  className={`border p-3 ${
                    finding.severity === 'critical'
                      ? 'border-red-300/25 bg-red-300/[0.035]'
                      : finding.severity === 'warning'
                        ? 'border-amber-300/20 bg-amber-300/[0.03]'
                        : 'border-[#2d2c28] bg-[#090907]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold text-stone-200">{finding.label}</p>
                    <span className={`text-[9px] font-bold uppercase tracking-[0.12em] ${
                      finding.severity === 'critical' ? 'text-red-200' : finding.severity === 'warning' ? 'text-amber-200' : 'text-stone-600'
                    }`}>{finding.severity}</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-stone-500">{finding.evidence}</p>
                  <p className="mt-2 text-[10px] leading-4 text-stone-400">
                    <span className="font-bold text-stone-500">Hermes recommendation:</span> {finding.recommendation}
                  </p>
                </div>
              ))}
            </div>

            <details className="mt-3 border border-[#25241f] bg-[#090907] p-3">
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Heuristic thresholds</summary>
              <div className="mt-2 space-y-1 text-[10px] leading-4 text-stone-600">
                <p>Slow: any run ≥30s or cumulative task runtime ≥60s.</p>
                <p>Elevated cost: loaded task run ledger ≥$0.10.</p>
                <p>Repeated attempts: retry count ≥2 or at least 3 run rows.</p>
                <p>Failure cluster: at least 2 failed child tasks in the loaded lineage.</p>
                <p>Orphan: depth &gt; 0 without a parent task reference.</p>
              </div>
            </details>
          </section>

          <section className="border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-amber-200" />
              <h2 className="text-sm font-bold text-white">Swarm drill-down</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Agent/run attribution, runtime metrics, tool signals, and parent/child execution lineage for the active Hermes task.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
              <div className="border border-[#25241f] bg-[#090907] p-3">
                <p className="uppercase tracking-[0.14em] text-stone-600">Agent</p>
                <p className="mt-1 truncate font-semibold text-stone-300">{latestRun?.agent_name ?? liveTask?.agent_name ?? '—'}</p>
              </div>
              <div className="border border-[#25241f] bg-[#090907] p-3">
                <p className="uppercase tracking-[0.14em] text-stone-600">Run</p>
                <p className="mt-1 font-mono text-stone-300">{latestRun ? `#${latestRun.run_number} · ${latestRun.id.slice(0, 8)}` : '—'}</p>
              </div>
              <div className="border border-[#25241f] bg-[#090907] p-3">
                <p className="uppercase tracking-[0.14em] text-stone-600">Tokens</p>
                <p className="mt-1 font-semibold text-stone-300">{totalRunTokens.toLocaleString()}</p>
              </div>
              <div className="border border-[#25241f] bg-[#090907] p-3">
                <p className="uppercase tracking-[0.14em] text-stone-600">Cost</p>
                <p className="mt-1 font-semibold text-stone-300">${totalRunCost.toFixed(4)}</p>
              </div>
              <div className="border border-[#25241f] bg-[#090907] p-3">
                <p className="uppercase tracking-[0.14em] text-stone-600">Run time</p>
                <p className="mt-1 font-semibold text-stone-300">{totalRunDuration ? `${(totalRunDuration / 1000).toFixed(1)} s` : '—'}</p>
              </div>
              <div className="border border-[#25241f] bg-[#090907] p-3">
                <p className="uppercase tracking-[0.14em] text-stone-600">Attempts</p>
                <p className="mt-1 font-semibold text-stone-300">{runs.length}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Tool / MCP attribution</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {toolSignals.length ? toolSignals.map((signal) => (
                  <span key={signal} className="border border-[#2d2c28] bg-[#0c0c0a] px-2 py-1 text-[10px] text-stone-400">{signal}</span>
                )) : (
                  <span className="text-[10px] text-stone-600">No task-linked tool signal recorded yet.</span>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-[#25241f] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Execution lineage</p>
              <div className="mt-3 space-y-2">
                {parentTask && (
                  <button onClick={() => setLiveTask(parentTask)} className="w-full border border-[#2d2c28] bg-[#0c0c0a] px-3 py-2 text-left hover:border-amber-200/30">
                    <span className="text-[9px] uppercase tracking-[0.12em] text-stone-600">Parent</span>
                    <span className="ml-2 text-[10px] font-semibold text-stone-300">{parentTask.title ?? parentTask.kind}</span>
                  </button>
                )}
                {liveTask && (
                  <div className="border border-amber-300/25 bg-amber-300/[0.04] px-3 py-2">
                    <span className="text-[9px] uppercase tracking-[0.12em] text-amber-200">Current</span>
                    <span className="ml-2 text-[10px] font-semibold text-stone-200">{liveTask.title ?? liveTask.kind}</span>
                  </div>
                )}
                {childTasks.map((child) => (
                  <button key={child.id} onClick={() => setLiveTask(child)} className="w-full border border-[#2d2c28] bg-[#0c0c0a] px-3 py-2 text-left hover:border-amber-200/30">
                    <span className="text-[9px] uppercase tracking-[0.12em] text-stone-600">Child · {child.status}</span>
                    <span className="ml-2 text-[10px] font-semibold text-stone-300">{child.title ?? child.kind}</span>
                  </button>
                ))}
                {!parentTask && childTasks.length === 0 && (
                  <div className="border border-[#25241f] bg-[#090907] px-3 py-2 text-[10px] text-stone-600">No parent/child task lineage recorded.</div>
                )}
              </div>
            </div>

            <details className="mt-4 border border-[#25241f] bg-[#090907] p-3">
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Run ledger</summary>
              <div className="mt-3 space-y-2">
                {runs.map((run) => (
                  <div key={run.id} className="border border-[#25241f] px-3 py-2 text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-stone-300">run #{run.run_number} · {run.id.slice(0, 8)}</span>
                      <span className="uppercase text-stone-600">{run.status}</span>
                    </div>
                    <p className="mt-1 text-stone-600">
                      {run.agent_name} · {run.tokens_used ?? 0} tokens · ${Number(run.cost_usd ?? 0).toFixed(4)} · {run.duration_ms ?? 0} ms
                    </p>
                    {run.error_detail && <p className="mt-1 text-red-300">{run.error_detail}</p>}
                  </div>
                ))}
                {!runs.length && <p className="text-[10px] text-stone-600">No Hermes run rows yet.</p>}
              </div>
            </details>
          </section>

          <section className="border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-stone-400" />
              <h2 className="text-sm font-bold text-white">Session activity</h2>
            </div>
            <div className="mt-3 space-y-2">
              {activity.map((item, index) => (
                <div key={`${item}-${index}`} className="border border-[#25241f] bg-[#090907] px-3 py-2 text-[11px] leading-5 text-stone-500">
                  {item}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className="mx-auto max-w-[1600px] px-5 pb-8 lg:px-8">
        <div className="grid gap-3 border border-[#2d2c28] bg-[#0d0d0b] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.28)] sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <Workflow className="mt-0.5 h-4 w-4 text-amber-200" />
            <div><p className="text-xs font-bold text-white">Traceable execution</p><p className="mt-1 text-[11px] leading-5 text-stone-500">Relationships make the path from intent to result inspectable.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <Film className="mt-0.5 h-4 w-4 text-amber-200" />
            <div><p className="text-xs font-bold text-white">Cross-product intelligence</p><p className="mt-1 text-[11px] leading-5 text-stone-500">Products can share governed capabilities without collapsing their boundaries.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-amber-200" />
            <div><p className="text-xs font-bold text-white">Human-governed actions</p><p className="mt-1 text-[11px] leading-5 text-stone-500">Discovery can be automatic; consequential mutations stay behind policy and approval gates.</p></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphOS;
