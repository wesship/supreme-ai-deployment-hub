import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type ReactFlowInstance,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '@/styles/knowledge-graph-effects.css';
import ConversationalVoiceControls from '@/components/ai/ConversationalVoiceControls';
import { useHermesEvents, type HermesStreamEvent } from '@/features/knowledge-graph/hooks/useHermesEvents';
import { deriveLiveExecutionPanels } from '@/features/knowledge-graph/lib/livePanels';
import type { D3GraphActionRequest } from '@/features/knowledge-graph/lib/graphActions';
import { deriveClusterActivation } from '@/features/knowledge-graph/lib/clusterActivation';
import { deriveMultiClusterCorridor } from '@/features/knowledge-graph/lib/multiClusterCorridor';
import { deriveCameraTarget, deriveDepthAnchor } from '@/features/knowledge-graph/lib/cameraChoreography';
import { useRuntimeIdentity } from '@/hooks/useRuntimeIdentity';
import { deriveOverlayEmphasis } from '@/features/knowledge-graph/lib/overlayEmphasis';
import CinematicDepthLayer from '@/features/knowledge-graph/components/CinematicDepthLayer';
import { deriveSelectiveFocus } from '@/features/knowledge-graph/lib/selectiveFocus';
import { sendHermesBrowserCommand } from '@/features/knowledge-graph/lib/hermesCommand';
import {
  deriveNexusTransitionKey,
  NEXUS_TRANSITION_TIMING,
  type NexusTransitionPhase,
} from '@/features/knowledge-graph/lib/transitionChoreography';
import {
  Activity,
  Bot,
  BrainCircuit,
  ChevronRight,
  Database,
  Eye,
  Network,
  Play,
  Radio,
  Search,
  Mic,
  Server,
  Users,
  Gauge,
  Coins,
  Clock3,
  LayoutGrid,
  List,
  Rows3,
  Focus,
  ShieldCheck,
  Sparkles,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react';

type NodeKind = 'core' | 'agent' | 'tool' | 'memory' | 'product' | 'security';

type HermesRuntimeState = 'idle' | 'connecting' | 'running' | 'complete' | 'failed';

type KnowledgeNodeData = {
  label: string;
  kind: NodeKind;
  route: string;
  description: string;
  state: 'ready' | 'governed' | 'adapter';
  runtimeState?: HermesRuntimeState;
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
    position: { x: 210, y: 120 },
    data: {
      label: 'People',
      kind: 'core',
      route: '/app',
      description: 'Users, teams, partners, and operator-directed intent entering the D3VONN fabric.',
      state: 'governed',
    },
  },
  {
    id: 'hermes',
    type: 'knowledge',
    position: { x: 515, y: 245 },
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
    position: { x: 260, y: 300 },
    data: {
      label: 'Agents',
      kind: 'agent',
      route: '/agents',
      description: 'Reusable specialist agents selected by Hermes for governed tasks.',
      state: 'ready',
    },
  },
  {
    id: 'knowledge',
    type: 'knowledge',
    position: { x: 500, y: 55 },
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
    position: { x: 820, y: 285 },
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
    position: { x: 455, y: 500 },
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
    position: { x: 65, y: 275 },
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
    position: { x: 90, y: 485 },
    data: {
      label: 'HNF Ecosystem',
      kind: 'product',
      route: '/music',
      description: 'Radio, TV, Academy, culture, publishing, and media orchestration surfaces.',
      state: 'adapter',
    },
  },
  {
    id: 'models',
    type: 'knowledge',
    position: { x: 800, y: 110 },
    data: {
      label: 'Models',
      kind: 'tool',
      route: '/app',
      description: 'LLM, VLM, multimodal, routing, and model-provider intelligence.',
      state: 'governed',
    },
  },
  {
    id: 'security',
    type: 'knowledge',
    position: { x: 790, y: 500 },
    data: {
      label: 'Security + Trust',
      kind: 'security',
      route: '/security/command-center',
      description: 'Policy, secrets, approvals, observability, and operating boundaries.',
      state: 'governed',
    },
  },
  {
    id: 'infrastructure',
    type: 'knowledge',
    position: { x: 635, y: 525 },
    data: {
      label: 'Infrastructure',
      kind: 'tool',
      route: '/command-center',
      description: 'GPU, servers, storage, databases, cloud, and edge runtime resources.',
      state: 'ready',
    },
  },
  {
    id: 'analytics',
    type: 'knowledge',
    position: { x: 990, y: 420 },
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
  { id: 'hermes-models', source: 'hermes', target: 'models' },
  { id: 'hermes-infrastructure', source: 'hermes', target: 'infrastructure' },
  { id: 'agents-workflow', source: 'agents', target: 'workflow' },
  { id: 'knowledge-workflow', source: 'knowledge', target: 'workflow' },
  { id: 'tools-security', source: 'tools', target: 'security' },
  { id: 'workflow-films', source: 'workflow', target: 'films' },
  { id: 'workflow-radio', source: 'workflow', target: 'radio' },
  { id: 'workflow-analytics', source: 'workflow', target: 'analytics' },
  { id: 'security-analytics', source: 'security', target: 'analytics' },
].map((edge) => ({
  ...edge,
  type: 'cinematic',
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


const explicitEventNode = (event: HermesStreamEvent): string | null => {
  const data = event.data ?? {};
  const candidates = [
    data.target_node_id,
    data.targetNodeId,
    data.source_node_id,
    data.sourceNodeId,
    data.node_id,
    data.nodeId,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && initialNodes.some((node) => node.id === candidate)) {
      return candidate;
    }
  }
  return null;
};

const inferEventNode = (event: HermesStreamEvent, selectedId: string): string => {
  const explicit = explicitEventNode(event);
  if (explicit) return explicit;

  const type = event.type.toLowerCase();
  const message = event.message.toLowerCase();
  const combined = `${type} ${message}`;

  if (combined.includes('memory') || combined.includes('rag') || combined.includes('retriev')) return 'knowledge';
  if (combined.includes('model') || combined.includes('llm') || combined.includes('vlm')) return 'models';
  if (combined.includes('gpu') || combined.includes('server') || combined.includes('infrastructure') || combined.includes('cloud')) return 'infrastructure';
  if (combined.includes('tool') || combined.includes('mcp') || combined.includes('connector')) return 'tools';
  if (combined.includes('security') || combined.includes('verify') || combined.includes('policy')) return 'security';
  if (combined.includes('agent') || combined.includes('dispatch') || combined.includes('worker')) return 'agents';
  if (combined.includes('workflow') || combined.includes('plan')) return 'workflow';
  if (combined.includes('complete') || combined.includes('result')) {
    return ['films', 'radio', 'security', 'analytics'].includes(selectedId) ? selectedId : 'analytics';
  }
  if (combined.includes('task.created') || combined.includes('request')) return 'intent';
  if (combined.includes('running') || combined.includes('start')) return 'hermes';
  return 'hermes';
};

const livePathFromEvents = (events: HermesStreamEvent[], selectedId: string): string[] => {
  const path: string[] = [];
  const push = (id: string) => {
    if (!path.includes(id)) path.push(id);
  };
  for (const event of events) {
    push(inferEventNode(event, selectedId));
  }
  return path;
};


type CinematicEdgeData = {
  executing?: boolean;
  clusterActive?: boolean;
  corridorActive?: boolean;
};

function CinematicEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const edgeData = data as CinematicEdgeData | undefined;
  const executing = Boolean(edgeData?.executing);
  const clusterActive = Boolean(edgeData?.clusterActive);
  const corridorActive = Boolean(edgeData?.corridorActive);

  return (
    <g
      className={[
        'd3-cinematic-edge',
        executing ? 'd3-cinematic-edge--executing' : '',
        clusterActive ? 'd3-cinematic-edge--cluster' : '',
        corridorActive ? 'd3-cinematic-edge--corridor' : '',
      ].filter(Boolean).join(' ')}
    >
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {(executing ? [0, 1, 2] : corridorActive ? [0, 1] : clusterActive ? [0] : []).map((index) => (
        <circle
          key={index}
          className={`d3-edge-particle d3-edge-particle--${index}`}
          r={index === 0 ? 3.2 : 2.2}
        >
          <animateMotion
            dur={
              executing
                ? (index === 0 ? '1.25s' : '1.75s')
                : corridorActive
                  ? (index === 0 ? '1.45s' : '2s')
                  : '2.4s'
            }
            begin={`${index * -0.42}s`}
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      ))}
    </g>
  );
}

function KnowledgeNode({ id, data, selected }: NodeProps<Node<KnowledgeNodeData>>) {
  const Icon = kindIcon[data.kind];

  if (id === 'hermes') {
    const runtimeState = data.runtimeState ?? 'idle';
    return (
      <div
        className={`d3-hermes-shell d3-hermes--${runtimeState} ${selected ? 'd3-hermes--selected' : ''}`}
        aria-label={`Hermes AI Orchestration · ${runtimeState}`}
      >
        <Handle type="target" position={Position.Left} className="d3-kg-handle !h-2.5 !w-2.5 !border-0 !bg-amber-100" />
        <div className="d3-hermes-orbit d3-hermes-orbit--outer" aria-hidden="true" />
        <div className="d3-hermes-orbit d3-hermes-orbit--inner" aria-hidden="true" />
        <div className="d3-hermes-core">
          <div className="d3-hermes-plasma" aria-hidden="true" />
          <BrainCircuit className="d3-hermes-glyph h-8 w-8" />
          <p className="d3-hermes-title">HERMES</p>
          <p className="d3-hermes-subtitle">AI ORCHESTRATION</p>
          <span className="d3-hermes-state">{runtimeState}</span>
        </div>
        <Handle type="source" position={Position.Right} className="d3-kg-handle !h-2.5 !w-2.5 !border-0 !bg-amber-100" />
      </div>
    );
  }

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
const edgeTypes = { cinematic: CinematicEdge };
const majorClusterNodeIds = new Set(['intent', 'agents', 'knowledge', 'models', 'tools', 'films', 'radio', 'workflow', 'infrastructure', 'security', 'analytics']);


const nexusNavItems = [
  { label: 'Command Center', route: '/command-center', icon: Gauge },
  { label: 'Knowledge Graph', route: '/knowledge-graph', icon: Network, active: true },
  { label: 'Hermes Orchestration', route: '/workflows', icon: BrainCircuit },
  { label: 'Agents', route: '/agents', icon: Bot },
  { label: 'Tools & Integrations', route: '/mcp', icon: Wrench },
  { label: 'Workflows', route: '/workflows', icon: Workflow },
  { label: 'Knowledge & RAG', route: '/dkos-ingestion', icon: Database },
  { label: 'AI Films', route: '/ai-films', icon: Sparkles },
  { label: 'HNF Ecosystem', route: '/music', icon: Radio },
  { label: 'Infrastructure', route: '/command-center', icon: Server },
  { label: 'Operations', route: '/operations', icon: Activity },
  { label: 'Security', route: '/security/command-center', icon: ShieldCheck },
  { label: 'Analytics', route: '/app', icon: Gauge },
  { label: 'D3VONN.IO Institute', route: '/institute', icon: Users },
] as const;

const KnowledgeGraphOS: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { identity: runtimeIdentity, state: runtimeIdentityState } = useRuntimeIdentity();
  const routeCorrelationId = searchParams.get('execution') || searchParams.get('correlation_id');
  const [voiceCorrelationId, setVoiceCorrelationId] = useState<string | null>(null);
  const liveCorrelationId = voiceCorrelationId || routeCorrelationId;
  const { events: liveEvents, state: liveStreamState, error: liveStreamError } = useHermesEvents(liveCorrelationId);
  const livePanels = useMemo(
    () => deriveLiveExecutionPanels(liveEvents, liveStreamState),
    [liveEvents, liveStreamState],
  );
  const [selectedId, setSelectedId] = useState('hermes');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<NodeKind | 'all'>('all');
  const [activity, setActivity] = useState<string[]>(['Graph surface initialized. No live mutations have been issued.']);
  const [executionPath, setExecutionPath] = useState<string[]>([]);
  const [executionStep, setExecutionStep] = useState(-1);
  const [viewMode, setViewMode] = useState<'graph' | 'map' | 'list'>('graph');
  const [secondaryClusterId, setSecondaryClusterId] = useState<string | null>(null);
  const [cameraFollow, setCameraFollow] = useState(true);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [transitionPhase, setTransitionPhase] = useState<NexusTransitionPhase>('idle');
  const [hermesInstruction, setHermesInstruction] = useState('');
  const [hermesSubmitting, setHermesSubmitting] = useState(false);
  const hermesInstructionRef = useRef<HTMLTextAreaElement | null>(null);
  const transitionTimersRef = useRef<number[]>([]);

  const selected = initialNodes.find((node) => node.id === selectedId) ?? initialNodes[1];
  const voiceContext = {
    surface: 'knowledge-graph',
    route: '/knowledge-graph',
    node_id: selected.id,
    node_label: selected.data.label,
    node_kind: selected.data.kind,
    canonical_route: selected.data.route,
    view_mode: viewMode,
  };

  useEffect(() => {
    if (liveCorrelationId || !executionPath.length) return;
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
  }, [executionPath, liveCorrelationId]);


  useEffect(() => {
    if (!liveCorrelationId || !liveEvents.length) return;
    const path = livePathFromEvents(liveEvents, selectedId);
    if (!path.length) return;
    setExecutionPath(path);
    setExecutionStep(path.length - 1);
    const latest = liveEvents[liveEvents.length - 1];
    setActivity((items) => [
      `LIVE · ${latest.type}: ${latest.message || latest.type}`,
      ...items.filter((item) => !item.startsWith('LIVE ·')),
    ].slice(0, 5));
  }, [liveCorrelationId, liveEvents, selectedId]);

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

  const clusterActivation = useMemo(
    () => deriveClusterActivation(selectedId, executionPath, initialEdges, majorClusterNodeIds),
    [executionPath, selectedId],
  );

  const multiClusterCorridor = useMemo(
    () => deriveMultiClusterCorridor(
      majorClusterNodeIds.has(selectedId) ? selectedId : null,
      secondaryClusterId,
      initialEdges,
    ),
    [secondaryClusterId, selectedId],
  );

  const corridorNodeIds = useMemo(
    () => new Set(multiClusterCorridor?.nodeIds ?? []),
    [multiClusterCorridor],
  );

  const corridorEdgeIds = useMemo(
    () => new Set(multiClusterCorridor?.edgeIds ?? []),
    [multiClusterCorridor],
  );

  const selectiveFocus = useMemo(
    () => deriveSelectiveFocus(
      initialNodes.map((node) => node.id),
      initialEdges,
      {
        selectedId,
        executionNodeIds,
        corridorNodeIds,
        clusterPrimaryId: clusterActivation.primaryNodeId,
        sympatheticNodeIds: clusterActivation.sympatheticNodeIds,
      },
    ),
    [
      clusterActivation.primaryNodeId,
      clusterActivation.sympatheticNodeIds,
      corridorNodeIds,
      executionNodeIds,
      selectedId,
    ],
  );

  const overlayEmphasis = useMemo(
    () => deriveOverlayEmphasis({
      selectedNodeId: selectedId,
      executionPath,
      hasLiveEvents: liveEvents.length > 0,
      hasCostTelemetry:
        livePanels.costUsd !== null ||
        livePanels.tokensUsed !== null ||
        livePanels.durationMs !== null,
      hasAgentTelemetry: livePanels.agents.length > 0,
      hasInfrastructureTelemetry: livePanels.infrastructure.length > 0,
      corridorNodeIds: multiClusterCorridor?.nodeIds ?? [],
    }),
    [executionPath, liveEvents.length, livePanels, multiClusterCorridor, selectedId],
  );

  const overlayClass = (panel: 'system' | 'activity' | 'execution' | 'agents' | 'infrastructure' | 'cost') =>
    [
      'd3-ops-overlay',
      overlayEmphasis.has(panel) ? 'd3-ops-overlay--active' : '',
      multiClusterCorridor ? 'd3-ops-overlay--corridor' : '',
      `d3-ops-overlay--transition-${transitionPhase}`,
    ].filter(Boolean).join(' ');

  const cameraFocusNodeIds = useMemo(() => {
    if (multiClusterCorridor?.nodeIds.length) return multiClusterCorridor.nodeIds;
    if (clusterActivation.primaryNodeId) return [clusterActivation.primaryNodeId];
    if (executionPath.length) return [executionPath[executionPath.length - 1]];
    return [];
  }, [clusterActivation.primaryNodeId, executionPath, multiClusterCorridor]);

  const depthAnchor = useMemo(
    () => deriveDepthAnchor(initialNodes, cameraFocusNodeIds.length ? cameraFocusNodeIds : ['hermes']),
    [cameraFocusNodeIds],
  );

  const transitionKey = useMemo(
    () => deriveNexusTransitionKey(
      cameraFocusNodeIds,
      livePanels.status,
      Boolean(multiClusterCorridor),
    ),
    [cameraFocusNodeIds, livePanels.status, multiClusterCorridor],
  );

  useEffect(() => {
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    transitionTimersRef.current = [];

    if (transitionKey === 'idle') {
      setTransitionPhase('idle');
      return;
    }

    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reducedMotion) {
      setTransitionPhase('focus');
      return;
    }

    setTransitionPhase('ignite');
    transitionTimersRef.current = [
      window.setTimeout(
        () => setTransitionPhase('route'),
        NEXUS_TRANSITION_TIMING.routeMs,
      ),
      window.setTimeout(
        () => setTransitionPhase('focus'),
        NEXUS_TRANSITION_TIMING.focusMs,
      ),
    ];

    return () => {
      transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      transitionTimersRef.current = [];
    };
  }, [transitionKey]);

  useEffect(() => {
    if (!cameraFollow || viewMode !== 'graph' || !flowInstance || !cameraFocusNodeIds.length) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const shouldMove =
      transitionPhase === 'route' ||
      (reducedMotion && transitionPhase === 'focus');
    if (!shouldMove) return;

    const target = deriveCameraTarget(initialNodes, cameraFocusNodeIds);
    if (!target) return;

    void flowInstance.setCenter(target.x, target.y, {
      zoom: target.zoom,
      duration: reducedMotion ? 0 : 850,
    });
  }, [cameraFocusNodeIds, cameraFollow, flowInstance, transitionPhase, viewMode]);

  const nodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialNodes.map((node) => ({
      ...node,
      selected: node.id === selectedId,
      data: node.id === 'hermes'
        ? { ...node.data, runtimeState: livePanels.status }
        : node.data,
      className: [
        executionNodeIds.has(node.id) ? 'd3-kg-runtime-node' : '',
        clusterActivation.primaryNodeId === node.id ? 'd3-kg-cluster-primary' : '',
        clusterActivation.sympatheticNodeIds.has(node.id) ? 'd3-kg-cluster-sympathetic' : '',
        corridorNodeIds.has(node.id) ? 'd3-kg-corridor-node' : '',
        multiClusterCorridor && node.id === 'hermes' ? 'd3-kg-multicluster-hermes' : '',
        secondaryClusterId === node.id ? 'd3-kg-secondary-selected' : '',
        selectiveFocus.defocusedNodeIds.has(node.id) ? 'd3-kg-defocused' : '',
      ].filter(Boolean).join(' ') || undefined,
      hidden:
        (kind !== 'all' && node.data.kind !== kind) ||
        Boolean(needle && !`${node.data.label} ${node.data.description} ${kindLabel[node.data.kind]}`.toLowerCase().includes(needle)),
    }));
  }, [clusterActivation, corridorNodeIds, executionNodeIds, kind, livePanels.status, multiClusterCorridor, query, secondaryClusterId, selectedId, selectiveFocus]);

  const edges = useMemo(() => {
    const visibleIds = new Set(nodes.filter((node) => !node.hidden).map((node) => node.id));
    return initialEdges.map((edge) => {
      const active = edge.source === selectedId || edge.target === selectedId;
      const platformEdge = ['films', 'radio', 'analytics', 'security'].includes(edge.target);
      const executing = executionEdgeIds.has(edge.id);
      const clusterActive = clusterActivation.clusterEdgeIds.has(edge.id);
      const corridorActive = corridorEdgeIds.has(edge.id);
      return {
      ...edge,
      className: [
        'd3-kg-edge',
        active ? 'd3-kg-edge--active' : '',
        platformEdge ? 'd3-kg-edge--platform' : '',
        executing ? 'd3-kg-edge--executing' : '',
        clusterActive ? 'd3-kg-edge--cluster' : '',
        corridorActive ? 'd3-kg-edge--corridor' : '',
        selectiveFocus.defocusedEdgeIds.has(edge.id) ? 'd3-kg-edge--defocused' : '',
      ].filter(Boolean).join(' '),
      animated: edge.source === 'hermes' || active || executing || clusterActive || corridorActive,
      data: {
        executing,
        clusterActive: clusterActive || corridorActive,
        corridorActive,
      },
      hidden: !visibleIds.has(edge.source) || !visibleIds.has(edge.target),
      style: {
        stroke: executing ? '#fef3c7' : corridorActive ? '#fff7d6' : clusterActive ? '#fcd34d' : active ? '#fde68a' : platformEdge ? '#fb923c' : '#78716c',
        strokeWidth: executing ? 3.2 : corridorActive ? 3 : clusterActive ? 2.1 : active ? 2.4 : platformEdge ? 1.7 : 1.3,
        opacity: executing ? 1 : corridorActive ? 1 : clusterActive ? 0.86 : active ? 0.98 : platformEdge ? 0.62 : 0.42,
      },
    };
    });
  }, [clusterActivation, corridorEdgeIds, executionEdgeIds, nodes, selectedId, selectiveFocus]);

  const recordAction = (action: string) => {
    setActivity((items) => [`${action}: ${selected.data.label}`, ...items].slice(0, 5));
  };

  const pathForNode = (nodeId: string): string[] => {
    const paths: Record<string, string[]> = {
      intent: ['intent'],
      hermes: ['intent', 'hermes'],
      agents: ['intent', 'hermes', 'agents'],
      knowledge: ['intent', 'hermes', 'knowledge'],
      tools: ['intent', 'hermes', 'tools'],
      models: ['intent', 'hermes', 'models'],
      infrastructure: ['intent', 'hermes', 'infrastructure'],
      workflow: ['intent', 'hermes', 'agents', 'workflow'],
      films: ['intent', 'hermes', 'agents', 'workflow', 'films'],
      radio: ['intent', 'hermes', 'agents', 'workflow', 'radio'],
      security: ['intent', 'hermes', 'tools', 'security'],
      analytics: ['intent', 'hermes', 'knowledge', 'workflow', 'analytics'],
    };
    return paths[nodeId] ?? ['intent', 'hermes'];
  };

  const resolveNodeId = (candidate?: string): string => {
    if (!candidate) return selected.id;
    const normalized = candidate.trim().toLowerCase();
    const byId = initialNodes.find((node) => node.id.toLowerCase() === normalized);
    if (byId) return byId.id;
    const byLabel = initialNodes.find((node) => node.data.label.toLowerCase() === normalized);
    return byLabel?.id ?? selected.id;
  };

  const startExecutionPreview = (nodeId = selected.id) => {
    const targetPath = pathForNode(nodeId);
    setExecutionStep(0);
    setExecutionPath(targetPath);
    setActivity((items) => [`Execution trace started: ${targetPath.join(' → ')}`, ...items].slice(0, 5));
  };

  const executeGraphAction = async (request: D3GraphActionRequest) => {
    const nodeId = resolveNodeId(request.nodeId);
    const node = initialNodes.find((item) => item.id === nodeId) ?? selected;

    switch (request.action) {
      case 'select':
        setSecondaryClusterId(null);
        setSelectedId(nodeId);
        setActivity((items) => [`${request.source.toUpperCase()} · selected ${node.data.label}`, ...items].slice(0, 5));
        break;
      case 'open':
        setSecondaryClusterId(null);
        setSelectedId(nodeId);
        navigate(node.data.route);
        break;
      case 'trace':
        setSecondaryClusterId(null);
        setSelectedId(nodeId);
        startExecutionPreview(nodeId);
        break;
      case 'run':
        setSelectedId(nodeId);
        if (request.source === 'click') {
          try {
            const result = await sendHermesBrowserCommand({
              action: 'run',
              node_id: nodeId,
              title: `Run ${node.data.label}`,
              surface: 'knowledge-graph',
              route: '/knowledge-graph',
            });
            setVoiceCorrelationId(result.correlation_id);
            setActivity((items) => [`CLICK · Hermes run queued for ${node.data.label}`, ...items].slice(0, 5));
          } catch (error) {
            setActivity((items) => [`ERROR · ${error instanceof Error ? error.message : 'Hermes run could not be queued'}`, ...items].slice(0, 5));
          }
        } else {
          setActivity((items) => [`VOICE · Hermes run requested for ${node.data.label}; awaiting governed execution`, ...items].slice(0, 5));
        }
        break;
      case 'monitor':
        setSelectedId(nodeId);
        if (request.source === 'click') {
          try {
            const result = await sendHermesBrowserCommand({
              action: 'monitor',
              node_id: nodeId,
              title: `Monitor ${node.data.label}`,
              surface: 'knowledge-graph',
              route: '/knowledge-graph',
            });
            setVoiceCorrelationId(result.correlation_id);
            setActivity((items) => [`CLICK · live Hermes monitor attached to ${node.data.label}`, ...items].slice(0, 5));
          } catch (error) {
            setActivity((items) => [`ERROR · ${error instanceof Error ? error.message : 'Hermes monitor could not be queued'}`, ...items].slice(0, 5));
          }
        } else {
          setActivity((items) => [`VOICE · monitoring ${node.data.label}`, ...items].slice(0, 5));
        }
        break;
      case 'connect': {
        setSelectedId(nodeId);
        const requestedTarget = request.targetNodeId || secondaryClusterId || undefined;
        if (!requestedTarget) {
          setActivity((items) => [`${request.source.toUpperCase()} · select a second major node before Connect`, ...items].slice(0, 5));
          break;
        }
        const targetNodeId = resolveNodeId(requestedTarget);
        if (majorClusterNodeIds.has(targetNodeId) && targetNodeId !== nodeId) {
          setSecondaryClusterId(targetNodeId);
        }
        if (request.source === 'click') {
          try {
            const result = await sendHermesBrowserCommand({
              action: 'connect',
              node_id: nodeId,
              target_node_id: targetNodeId,
              title: `Connect ${node.data.label} to ${initialNodes.find((item) => item.id === targetNodeId)?.data.label ?? targetNodeId}`,
              surface: 'knowledge-graph',
              route: '/knowledge-graph',
            });
            setVoiceCorrelationId(result.correlation_id);
            setActivity((items) => [`CLICK · connection staged in Hermes for approval`, ...items].slice(0, 5));
          } catch (error) {
            setActivity((items) => [`ERROR · ${error instanceof Error ? error.message : 'Hermes connection could not be staged'}`, ...items].slice(0, 5));
          }
        } else {
          setActivity((items) => [`VOICE · connection request staged for approval`, ...items].slice(0, 5));
        }
        break;
      }
      case 'expand':
        setSelectedId(nodeId);
        setKind('all');
        setActivity((items) => [`${request.source.toUpperCase()} · expanded ${node.data.label} relationships`, ...items].slice(0, 5));
        break;
      case 'filter': {
        const value = request.filter?.toLowerCase().trim() ?? '';
        const aliases: Record<string, NodeKind> = {
          agents: 'agent',
          agent: 'agent',
          tools: 'tool',
          tool: 'tool',
          mcp: 'tool',
          memory: 'memory',
          knowledge: 'memory',
          products: 'product',
          product: 'product',
          security: 'security',
          governance: 'security',
          core: 'core',
          orchestration: 'core',
        };
        setKind(aliases[value] ?? 'all');
        setActivity((items) => [`VOICE · filter: ${value || 'all'}`, ...items].slice(0, 5));
        break;
      }
      case 'search':
        setQuery(request.query ?? '');
        setActivity((items) => [`${request.source.toUpperCase()} · search: ${request.query || 'cleared'}`, ...items].slice(0, 5));
        break;
      case 'ask':
        setSelectedId(nodeId);
        setHermesInstruction(
          request.query?.trim() || `Review ${node.data.label} and tell me what needs my attention.`,
        );
        setActivity((items) => [`${request.source.toUpperCase()} · Hermes instruction prepared for ${node.data.label}`, ...items].slice(0, 5));
        break;
      case 'view':
        if (request.view) {
          setViewMode(request.view);
          setActivity((items) => [`${request.source.toUpperCase()} · switched to ${request.view} view`, ...items].slice(0, 5));
        }
        break;
      case 'stop':
        setExecutionPath([]);
        setExecutionStep(-1);
        setSecondaryClusterId(null);
        setVoiceCorrelationId(null);
        setActivity((items) => [`${request.source.toUpperCase()} · graph execution view stopped`, ...items].slice(0, 5));
        break;
    }
  };

  return (
    <div className="min-h-screen bg-[#080806] text-stone-100">
      <header className="d3-nexus-topbar border-b border-[#2d2c28] bg-[#090907]/95 shadow-[0_6px_24px_rgba(0,0,0,0.32)]">
        <div className="mx-auto flex max-w-[1920px] items-center gap-5 px-4 py-3 lg:px-5">
          <Link to="/" className="min-w-[190px]">
            <p className="text-xl font-black tracking-[0.22em] text-amber-100">D3VONN</p>
            <p className="text-[8px] font-bold uppercase tracking-[0.34em] text-stone-400">AI Business Operating System</p>
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-1 xl:flex" aria-label="Primary">
            {[
              ['Home', '/'],
              ['Knowledge Graph', '/knowledge-graph'],
              ['Hermes', '/workflows'],
              ['Agents', '/agents'],
              ['Workflows', '/workflows'],
              ['Infrastructure', '/command-center'],
              ['AI Films', '/ai-films'],
              ['HNF', '/music'],
              ['Marketplace', '/marketplace'],
            ].map(([label, route]) => (
              <Link
                key={label}
                to={route}
                className={`border-b-2 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition ${
                  label === 'Knowledge Graph'
                    ? 'border-amber-300 text-amber-100'
                    : 'border-transparent text-stone-400 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ConversationalVoiceControls
              context={voiceContext}
              onExecutionStarted={setVoiceCorrelationId}
              onGraphAction={executeGraphAction}
            />
            <span className="hidden border border-[#4b4633] bg-[#15140f] px-3 py-1.5 text-[10px] text-amber-100/75 sm:inline">
              {liveCorrelationId ? `Hermes · ${liveStreamState}` : 'Hermes · standby'}
            </span>
            <span
              className={`hidden border px-3 py-1.5 text-[10px] lg:inline ${
                runtimeIdentityState === 'connected'
                  ? 'border-emerald-300/25 bg-emerald-300/[0.05] text-emerald-200'
                  : runtimeIdentityState === 'mismatch'
                    ? 'border-red-400/30 bg-red-500/[0.06] text-red-200'
                    : 'border-[#34332f] bg-[#11110f] text-stone-400'
              }`}
              title={runtimeIdentity?.commit_sha ? `Backend commit ${runtimeIdentity.commit_sha}` : undefined}
            >
              {runtimeIdentityState === 'connected'
                ? 'Backend · repo connected'
                : runtimeIdentityState === 'mismatch'
                  ? 'Backend · mismatch'
                  : runtimeIdentityState === 'unavailable'
                    ? 'Backend · unavailable'
                    : 'Backend · checking'}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1920px] gap-3 px-3 py-3 xl:grid-cols-[220px_minmax(0,1fr)_310px] xl:px-4">
        <aside className="d3-nexus-left-rail hidden border border-[#2d2c28] bg-[#0c0c0a] p-2 xl:block">
          <div className="mb-2 border-b border-[#25241f] px-3 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400">Platform</p>
            <p className="mt-1 text-xs font-semibold text-stone-300">Command surfaces</p>
          </div>
          <nav className="space-y-1" aria-label="D3VONN command surfaces">
            {nexusNavItems.map(({ label, route, icon: Icon, active }) => (
              <Link
                key={label}
                to={route}
                className={`flex items-center gap-3 border px-3 py-2.5 text-[11px] font-semibold transition ${
                  active
                    ? 'border-amber-300/30 bg-amber-200/[0.08] text-amber-100 shadow-[inset_3px_0_0_#fcd34d]'
                    : 'border-transparent text-stone-400 hover:border-[#34332f] hover:bg-white/[0.02] hover:text-stone-200'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <section className="overflow-hidden border border-[#2d2c28] bg-[#0b0b09] shadow-[0_16px_40px_rgba(0,0,0,0.32)]">
          <div className="border-b border-[#2d2c28] bg-[#10100d] px-4 py-4">
            <div className="mb-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-200/60">D3VONN Knowledge Universe</p>
              {/* Canonical D3VONN business headline; layout tests lock this wording. */}
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                One Platform. <span className="text-amber-100">One Intelligence.</span>
              </h1>
              <p className="mt-1 text-[11px] text-stone-400">
                Request → Hermes → Agents → Tools → Memory → Governed Result
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-w-[260px] flex-1 items-center gap-2 border border-[#34332f] bg-[#11110f] px-3 py-2">
              <Search className="h-4 w-4 text-stone-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search agents, tools, memory, products..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-stone-400"
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
            <button
              type="button"
              onClick={() => setCameraFollow((value) => !value)}
              aria-pressed={cameraFollow}
              className={`flex items-center gap-1.5 border border-[#34332f] px-3 py-2 text-xs font-semibold transition ${
                cameraFollow
                  ? 'bg-amber-200/[0.08] text-amber-100'
                  : 'bg-[#11110f] text-stone-400 hover:text-white'
              }`}
              title="Automatically focus the active execution region"
            >
              <Focus className="h-3.5 w-3.5" />
              Camera follow
            </button>
            <div className="flex border border-[#34332f] bg-[#11110f] p-1" role="group" aria-label="Knowledge graph view">
              {([
                ['graph', Network, 'Graph'],
                ['map', LayoutGrid, 'Map'],
                ['list', List, 'List'],
              ] as const).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => executeGraphAction({ action: 'view', view: mode, source: 'click' })}
                  aria-pressed={viewMode === mode}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition ${
                    viewMode === mode
                      ? 'bg-amber-200 text-stone-950'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          </div>

          {viewMode === 'graph' && (
            <div className={`d3-neural-stage h-[680px] d3-transition-${transitionPhase} ${cameraFocusNodeIds.length ? 'd3-neural-stage--focused' : ''} ${multiClusterCorridor ? 'd3-neural-stage--corridor' : ''} ${selectiveFocus.active ? 'd3-neural-stage--dof' : ''}`}>
              <div className="d3-nexus-globe" aria-hidden="true" />
              <CinematicDepthLayer
                runtimeState={livePanels.status}
                active={cameraFocusNodeIds.length > 0 || livePanels.status === 'running' || livePanels.status === 'connecting'}
                corridor={Boolean(multiClusterCorridor)}
                anchor={depthAnchor}
              />
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onInit={setFlowInstance}
                onNodeClick={(event, node) => {
                  if ((event.shiftKey || event.ctrlKey || event.metaKey) && majorClusterNodeIds.has(node.id) && node.id !== selectedId) {
                    setSecondaryClusterId(node.id);
                    setActivity((items) => [`MULTI · corridor target: ${node.data.label}`, ...items].slice(0, 5));
                  } else {
                    setSelectedId(node.id);
                    setSecondaryClusterId(null);
                  }
                }}
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
          )}

          {viewMode === 'map' && (
            <div className="min-h-[680px] bg-[radial-gradient(circle_at_center,rgba(252,211,77,0.06),transparent_42%)] p-6">
              <div className="grid gap-6 lg:grid-cols-3">
                {[
                  { title: 'Intent + Orchestration', ids: ['intent', 'hermes'] },
                  { title: 'Intelligence Fabric', ids: ['agents', 'knowledge', 'models', 'tools', 'workflow'] },
                  { title: 'Platform Surfaces', ids: ['films', 'radio', 'infrastructure', 'security', 'analytics'] },
                ].map((cluster) => (
                  <section key={cluster.title} className="border border-[#2d2c28] bg-[#0d0d0b] p-4">
                    <div className="flex items-center gap-2 border-b border-[#25241f] pb-3">
                      <Rows3 className="h-4 w-4 text-amber-200" />
                      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-stone-300">{cluster.title}</h2>
                    </div>
                    <div className="mt-4 space-y-3">
                      {cluster.ids.map((id) => {
                        const node = nodes.find((item) => item.id === id);
                        if (!node || node.hidden) return null;
                        const active = executionNodeIds.has(id);
                        return (
                          <button
                            type="button"
                            key={id}
                            onClick={() => setSelectedId(id)}
                            className={`w-full border p-3 text-left transition ${
                              selectedId === id
                                ? 'border-amber-300/60 bg-amber-200/[0.08]'
                                : active
                                  ? 'border-amber-300/30 bg-amber-200/[0.04]'
                                  : 'border-[#2d2c28] bg-[#11110f] hover:border-[#5b5540]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-bold text-white">{node.data.label}</span>
                              <span className="text-[9px] uppercase tracking-[0.12em] text-stone-400">{kindLabel[node.data.kind]}</span>
                            </div>
                            <p className="mt-2 text-[11px] leading-5 text-stone-400">{node.data.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'list' && (
            <div className="min-h-[680px] overflow-x-auto p-4">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#34332f] text-[10px] uppercase tracking-[0.14em] text-stone-400">
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">State</th>
                    <th className="px-3 py-3">Execution</th>
                    <th className="px-3 py-3">Route</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.filter((node) => !node.hidden).map((node) => (
                    <tr
                      key={node.id}
                      onClick={() => setSelectedId(node.id)}
                      className={`cursor-pointer border-b border-[#25241f] text-sm transition ${
                        selectedId === node.id ? 'bg-amber-200/[0.07]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="px-3 py-4 font-semibold text-white">{node.data.label}</td>
                      <td className="px-3 py-4 text-stone-400">{kindLabel[node.data.kind]}</td>
                      <td className="px-3 py-4 text-stone-400">{stateLabel[node.data.state]}</td>
                      <td className="px-3 py-4">
                        <span className={executionNodeIds.has(node.id) ? 'text-amber-200' : 'text-stone-400'}>
                          {executionNodeIds.has(node.id) ? 'Active path' : 'Idle'}
                        </span>
                      </td>
                      <td className="px-3 py-4 font-mono text-xs text-stone-400">{node.data.route}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="d3-nexus-actionbar flex flex-wrap items-center justify-center gap-2 border-t border-[#2d2c28] bg-[#0d0d0b] px-4 py-3">
            <button type="button" onClick={() => void executeGraphAction({ action: 'expand', nodeId: selected.id, source: 'click' })} className="d3-nexus-action d3-nexus-action--primary">
              <Network className="h-4 w-4" /> Explore
            </button>
            <button type="button" onClick={() => executeGraphAction({ action: 'trace', nodeId: selected.id, source: 'click' })} className="d3-nexus-action">
              <Eye className="h-4 w-4" /> Trace
            </button>
            <button type="button" onClick={() => executeGraphAction({ action: 'run', nodeId: selected.id, source: 'click' })} className="d3-nexus-action">
              <Play className="h-4 w-4" /> Run
            </button>
            <button type="button" onClick={() => executeGraphAction({ action: 'connect', nodeId: selected.id, source: 'click' })} className="d3-nexus-action">
              <Zap className="h-4 w-4" /> Connect
            </button>
            <button type="button" onClick={() => executeGraphAction({ action: 'monitor', nodeId: selected.id, source: 'click' })} className="d3-nexus-action">
              <Activity className="h-4 w-4" /> Monitor
            </button>
            <button type="button" onClick={() => executeGraphAction({ action: 'ask', nodeId: selected.id, source: 'click' })} className="d3-nexus-action">
              <BrainCircuit className="h-4 w-4" /> AI Assist
            </button>
          </div>
        </section>

        <aside className="d3-nexus-right-rail flex flex-col gap-3">
          <section className="border border-[#4b4633] bg-[#15140f] p-5 shadow-[inset_3px_0_0_#fcd34d,0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-amber-200" />
              <h2 className="text-sm font-bold text-white">Voice command layer</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-400">
              Speak naturally to Hermes. Voice and clicks share the same governed execution boundary. Shift/Ctrl/⌘-click a second major node to reveal a shared corridor.
            </p>
            <div className="mt-4 space-y-2 text-[11px] text-stone-400">
              {[
                '“Hermes, show infrastructure.”',
                '“Trace HNF Radio.”',
                '“Open AI Films.”',
                '“Monitor this agent.”',
                '“Find a bridge between Academy and AI Films.”',
                '“Switch to list view.”',
                '“Show the infrastructure map.”',
              ].map((example) => (
                <div key={example} className="border border-[#2d2c28] bg-[#0c0c0a] px-3 py-2">
                  {example}
                </div>
              ))}
            </div>
            <div className="mt-4 border border-[#34332f] bg-[#0c0c0a] p-3">
              <label htmlFor="hermes-instruction" className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-100">
                Text Hermes instructions
              </label>
              <textarea
                ref={hermesInstructionRef}
                id="hermes-instruction"
                value={hermesInstruction}
                onChange={(event) => setHermesInstruction(event.target.value)}
                rows={3}
                placeholder={`Tell Hermes what to do with ${selected.data.label}...`}
                className="mt-2 w-full resize-none border border-[#34332f] bg-[#11110f] px-3 py-2 text-xs leading-5 text-white outline-none placeholder:text-stone-500 focus:border-amber-200/40"
              />
              <button
                type="button"
                disabled={hermesSubmitting}
                onClick={async () => {
                  const prompt = hermesInstruction.trim();
                  if (!prompt) {
                    hermesInstructionRef.current?.focus();
                    setActivity((items) => ['TEXT · enter an instruction for Hermes', ...items].slice(0, 5));
                    return;
                  }
                  if (hermesSubmitting) return;
                  setHermesSubmitting(true);
                  try {
                    const result = await sendHermesBrowserCommand({
                      action: 'command',
                      title: `Hermes instruction · ${selected.data.label}`,
                      prompt,
                      node_id: selected.id,
                      surface: 'knowledge-graph',
                      route: '/knowledge-graph',
                    });
                    setVoiceCorrelationId(result.correlation_id);
                    setActivity((items) => [`TEXT · Hermes instruction queued for ${selected.data.label}`, ...items].slice(0, 5));
                    setHermesInstruction('');
                  } catch (error) {
                    setActivity((items) => [`ERROR · ${error instanceof Error ? error.message : 'Hermes instruction could not be queued'}`, ...items].slice(0, 5));
                  } finally {
                    setHermesSubmitting(false);
                  }
                }}
                className="mt-2 w-full border border-amber-300/30 bg-amber-200 px-3 py-2 text-xs font-black text-stone-950 transition hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60"
              >
                {hermesSubmitting ? 'Sending to Hermes…' : 'Send to Hermes'}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#2d2c28] pt-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Production voice</p>
                <p className="mt-1 text-xs text-stone-300">Vapi orchestration · ElevenLabs voice · Hermes tools</p>
              </div>
              <ConversationalVoiceControls
                context={voiceContext}
                onExecutionStarted={setVoiceCorrelationId}
                onGraphAction={executeGraphAction}
              />
            </div>
          </section>

          <section className={`${overlayClass('system')} order-1 border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-amber-200" />
                <h2 className="text-sm font-bold text-white">System status</h2>
              </div>
              <span className={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                livePanels.status === 'failed'
                  ? 'border-red-400/30 bg-red-500/[0.08] text-red-200'
                  : livePanels.status === 'complete'
                    ? 'border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-200'
                    : livePanels.status === 'running'
                      ? 'border-amber-300/25 bg-amber-300/[0.06] text-amber-100'
                      : 'border-[#34332f] bg-[#0c0c0a] text-stone-400'
              }`}>
                {livePanels.status}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="d3-nexus-stat-card border border-[#2d2c28] bg-[#0c0c0a] p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-400">Active Agents</p>
                <p className="mt-1 text-lg font-black text-white">{livePanels.agents.length || '—'}</p>
                <p className="mt-1 text-[9px] text-stone-400">{livePanels.agents.length ? 'current execution' : 'not reported'}</p>
              </div>
              <div className="d3-nexus-stat-card border border-[#2d2c28] bg-[#0c0c0a] p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-400">Running Tasks</p>
                <p className="mt-1 text-lg font-black text-white">{liveCorrelationId ? (livePanels.status === 'running' ? 1 : 0) : '—'}</p>
                <p className="mt-1 text-[9px] text-stone-400">{liveCorrelationId ? 'tracked stream' : 'not reported'}</p>
              </div>
              <div className="d3-nexus-stat-card border border-[#2d2c28] bg-[#0c0c0a] p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-400">Success Rate</p>
                <p className="mt-1 text-lg font-black text-white">—</p>
                <p className="mt-1 text-[9px] text-stone-400">not reported</p>
              </div>
              <div className="d3-nexus-stat-card border border-[#2d2c28] bg-[#0c0c0a] p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-400">Uptime</p>
                <p className="mt-1 text-lg font-black text-white">—</p>
                <p className="mt-1 text-[9px] text-stone-400">not reported</p>
              </div>
            </div>
            <div className="mt-3 border-t border-[#25241f] pt-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-stone-400">Current stage</p>
              <p className="mt-1 truncate text-xs font-bold text-stone-300">
                {executionPath.length ? initialNodes.find((node) => node.id === executionPath[executionPath.length - 1])?.data.label ?? 'Hermes' : 'Standby'}
              </p>
              <p className="mt-2 text-[9px] text-stone-400">
                {livePanels.asOf ? `As of ${new Date(livePanels.asOf).toLocaleTimeString()}` : 'No live execution timestamp reported'}
              </p>
            </div>
          </section>

          <section className="hidden border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Selected node</p>
                <h2 className="mt-1 text-xl font-black text-white">{selected.data.label}</h2>
              </div>
              <span className="border border-emerald-300/20 bg-[#101713] px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                {stateLabel[selected.data.state]}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-stone-400">{selected.data.description}</p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => executeGraphAction({ action: 'trace', nodeId: selected.id, source: 'click' })} className="flex items-center justify-center gap-2 border border-[#34332f] bg-[#11110f] px-3 py-2.5 text-xs font-semibold hover:border-amber-100/30">
                <Eye className="h-4 w-4" /> Trace
              </button>
              <button onClick={() => executeGraphAction({ action: 'run', nodeId: selected.id, source: 'click' })} className="flex items-center justify-center gap-2 border border-[#34332f] bg-[#11110f] px-3 py-2.5 text-xs font-semibold hover:border-amber-100/30">
                <Play className="h-4 w-4" /> Run trace
              </button>
              <button onClick={() => executeGraphAction({ action: 'monitor', nodeId: selected.id, source: 'click' })} className="flex items-center justify-center gap-2 border border-[#34332f] bg-[#11110f] px-3 py-2.5 text-xs font-semibold hover:border-amber-100/30">
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


          {multiClusterCorridor && (
            <section className="border border-amber-300/30 bg-[#15130d] p-5 shadow-[inset_3px_0_0_rgba(254,243,199,.8),0_12px_28px_rgba(0,0,0,.24)]">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-amber-100" />
                <h2 className="text-sm font-bold text-white">Multi-cluster corridor</h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-400">
                Shared route between the two active clusters. Hermes coordinates the corridor without merging their governance boundaries.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {multiClusterCorridor.nodeIds.map((id, index) => {
                  const node = initialNodes.find((item) => item.id === id);
                  return (
                    <React.Fragment key={id}>
                      {index > 0 && <span className="self-center text-amber-300/50">→</span>}
                      <button
                        type="button"
                        onClick={() => setSelectedId(id)}
                        className="border border-amber-300/25 bg-amber-200/[0.06] px-2 py-1 text-[10px] font-semibold text-amber-100"
                      >
                        {node?.data.label ?? id}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setSecondaryClusterId(null)}
                className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 hover:text-white"
              >
                Clear second cluster
              </button>
            </section>
          )}

          <section className="order-3 border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-amber-200" />
              <h2 className="text-sm font-bold text-white">Bridge opportunities</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-400">
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
                  <p className="mt-1.5 text-[11px] leading-5 text-stone-400">{idea.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {idea.path.map((step) => (
                      <span key={step} className="border border-[#2d2c28] bg-[#141411] px-1.5 py-1 text-[9px] font-medium text-stone-400">{step}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="hidden border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-amber-200" />
              <h2 className="text-sm font-bold text-white">Execution propagation</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-400">
              {liveCorrelationId
                ? 'Bound to an authenticated Hermes execution. Graph state follows persisted lifecycle events.'
                : 'Preview mode. Attach ?execution=<correlation-id> to follow a real authenticated Hermes execution.'}
            </p>
            {liveStreamError && (
              <div className="mt-3 border border-red-400/20 bg-red-500/[0.06] px-3 py-2 text-[11px] text-red-200">
                {liveStreamError}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(executionPath.length ? executionPath : ['intent', 'hermes', 'agents', 'workflow', 'platform']).map((id, index) => {
                const node = initialNodes.find((item) => item.id === id);
                const active = executionPath.length > 0 && index <= executionStep;
                return (
                  <span
                    key={`${id}-${index}`}
                    className={`border px-2 py-1 text-[10px] font-semibold transition ${active ? 'border-amber-300/50 bg-amber-200/10 text-amber-100' : 'border-[#2d2c28] bg-[#0c0c0a] text-stone-400'}`}
                  >
                    {node?.data.label ?? id}
                  </span>
                );
              })}
            </div>
          </section>

          <section className={`${overlayClass('activity')} order-2 border border-[#2f2e2a] bg-[#11110f] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.24)]`}>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-stone-400" />
              <h2 className="text-sm font-bold text-white">Recent activity</h2>
            </div>
            <div className="mt-3 space-y-2">
              {(livePanels.latestActivity.length ? livePanels.latestActivity : activity.map((message, index) => ({
                id: `preview-${index}`,
                type: 'preview',
                message,
                level: 'info',
              }))).map((item) => (
                <div key={item.id} className="border border-[#25241f] bg-[#090907] px-3 py-2 text-[11px] leading-5 text-stone-400">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-stone-300">{item.type}</span>
                    {'timestamp' in item && item.timestamp ? (
                      <span className="text-[9px] text-stone-400">{new Date(item.timestamp).toLocaleTimeString()}</span>
                    ) : null}
                  </div>
                  <p className="mt-1">{item.message || item.type}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className="mx-auto max-w-[1920px] px-3 pb-4 xl:px-4">
        <div className="grid gap-4 lg:grid-cols-4">
          <section className={`${overlayClass('execution')} border border-[#2d2c28] bg-[#0d0d0b] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.28)]`}>
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-amber-200" />
              <h2 className="text-sm font-bold text-white">Execution flow</h2>
            </div>
            <div className="mt-4 space-y-2">
              {(executionPath.length ? executionPath : ['intent', 'hermes']).map((id, index) => {
                const node = initialNodes.find((item) => item.id === id);
                const complete = index <= executionStep;
                return (
                  <div key={id} className="flex items-center gap-2 text-[11px]">
                    <span className={`h-2 w-2 rounded-full ${complete ? 'bg-amber-200 shadow-[0_0_8px_rgba(252,211,77,.5)]' : 'bg-stone-700'}`} />
                    <span className={complete ? 'text-stone-200' : 'text-stone-400'}>{node?.data.label ?? id}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={`${overlayClass('agents')} border border-[#2d2c28] bg-[#0d0d0b] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.28)]`}>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-200" />
              <h2 className="text-sm font-bold text-white">Top agents</h2>
            </div>
            <div className="mt-4 space-y-2">
              {livePanels.agents.length ? livePanels.agents.map((agent) => (
                <div key={agent.name} className="border border-[#25241f] bg-[#090907] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-stone-200">{agent.name}</span>
                    <span className="text-[10px] text-amber-200">{agent.events}</span>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-stone-400">{agent.lastEvent}</p>
                </div>
              )) : (
                <p className="text-[11px] leading-5 text-stone-400">No agent identity has been reported by this execution.</p>
              )}
            </div>
          </section>

          <section className={`${overlayClass('infrastructure')} border border-[#2d2c28] bg-[#0d0d0b] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.28)]`}>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-amber-200" />
              <h2 className="text-sm font-bold text-white">Infrastructure</h2>
            </div>
            <div className="mt-4 space-y-2">
              {livePanels.infrastructure.length ? livePanels.infrastructure.map((item) => (
                <div key={item.name} className="flex items-center justify-between border border-[#25241f] bg-[#090907] px-3 py-2 text-[11px]">
                  <span className="text-stone-300">{item.name}</span>
                  <span className="text-emerald-200">{item.state}</span>
                </div>
              )) : (
                <p className="text-[11px] leading-5 text-stone-400">No infrastructure dependency has been reported by this execution.</p>
              )}
            </div>
          </section>

          <section className={`${overlayClass('cost')} border border-[#2d2c28] bg-[#0d0d0b] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.28)]`}>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-200" />
              <h2 className="text-sm font-bold text-white">Cost & usage</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div className="border border-[#25241f] bg-[#090907] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.14em] text-stone-400">Cost</p>
                <p className="mt-1 text-sm font-bold text-white">{livePanels.costUsd === null ? 'Not reported' : `${livePanels.costUsd.toFixed(4)}`}</p>
              </div>
              <div className="border border-[#25241f] bg-[#090907] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.14em] text-stone-400">Tokens</p>
                <p className="mt-1 text-sm font-bold text-white">{livePanels.tokensUsed === null ? 'Not reported' : livePanels.tokensUsed.toLocaleString()}</p>
              </div>
              <div className="border border-[#25241f] bg-[#090907] px-3 py-2">
                <p className="flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-stone-400"><Clock3 className="h-3 w-3" /> Runtime</p>
                <p className="mt-1 text-sm font-bold text-white">{livePanels.durationMs === null ? 'Not reported' : `${(livePanels.durationMs / 1000).toFixed(2)}s`}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphOS;
