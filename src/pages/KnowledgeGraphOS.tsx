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
  kind: string;
  title: string | null;
  status: string;
  depth?: number | null;
  created_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
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
  if (value.includes('workflow') || value.includes('complete') || value.includes('result')) {
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
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [runs, setRuns] = useState<HermesRunRow[]>([]);
  const [taskLogs, setTaskLogs] = useState<HermesLogRow[]>([]);
  const [parentTask, setParentTask] = useState<HermesTaskRow | null>(null);
  const [childTasks, setChildTasks] = useState<HermesTaskRow[]>([]);
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
          const signal = `${row.kind} ${row.title ?? ''} ${row.status}`;
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
        .select('id,parent_task_id,goal_id,kind,title,status,depth,created_at,completed_at,error_message,agent_name')
        .eq('parent_task_id', task.id)
        .order('created_at', { ascending: true })
        .limit(50);

      const parentQuery = task.parent_task_id
        ? supabase
            .from('hermes_tasks')
            .select('id,parent_task_id,goal_id,kind,title,status,depth,created_at,completed_at,error_message,agent_name')
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
              <span className={`border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${liveTask?.status === 'failed' ? 'border-red-300/30 bg-red-300/10 text-red-200' : liveTask?.status === 'completed' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/30 bg-amber-300/10 text-amber-100'}`}>
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
                    {liveTask ? 'No task-linked timeline rows available yet.' : 'Waiting for a live Hermes task.'}
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
