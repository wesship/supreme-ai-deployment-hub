import React, { useMemo, useState } from 'react';
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
import ConversationalVoiceControls from '@/components/ai/ConversationalVoiceControls';
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
        'min-w-[210px] border border-[#34332f] bg-[#141411] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition',
        selected
          ? 'border-amber-300 bg-[#1b1913] shadow-[inset_3px_0_0_#fcd34d,0_10px_28px_rgba(0,0,0,0.35)]'
          : 'border-[#34332f] bg-[#141411] hover:border-[#665f46]',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-amber-200/70" />
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
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-amber-200/70" />
    </div>
  );
}

const nodeTypes = { knowledge: KnowledgeNode };

const KnowledgeGraphOS: React.FC = () => {
  const [selectedId, setSelectedId] = useState('hermes');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<NodeKind | 'all'>('all');
  const [activity, setActivity] = useState<string[]>(['Graph surface initialized. No live mutations have been issued.']);

  const selected = initialNodes.find((node) => node.id === selectedId) ?? initialNodes[1];
  const voiceContext = {
    surface: 'knowledge-graph',
    route: '/knowledge-graph',
    node_id: selected.id,
    node_label: selected.data.label,
    node_kind: selected.data.kind,
    canonical_route: selected.data.route,
  };

  const nodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialNodes.map((node) => ({
      ...node,
      selected: node.id === selectedId,
      hidden:
        (kind !== 'all' && node.data.kind !== kind) ||
        Boolean(needle && !`${node.data.label} ${node.data.description} ${kindLabel[node.data.kind]}`.toLowerCase().includes(needle)),
    }));
  }, [kind, query, selectedId]);

  const edges = useMemo(() => {
    const visibleIds = new Set(nodes.filter((node) => !node.hidden).map((node) => node.id));
    return initialEdges.map((edge) => ({
      ...edge,
      hidden: !visibleIds.has(edge.source) || !visibleIds.has(edge.target),
      style: {
        stroke: edge.source === selectedId || edge.target === selectedId ? '#fde68a' : '#78716c',
        strokeWidth: edge.source === selectedId || edge.target === selectedId ? 2.4 : 1.3,
        opacity: edge.source === selectedId || edge.target === selectedId ? 0.95 : 0.45,
      },
    }));
  }, [nodes, selectedId]);

  const recordAction = (action: string) => {
    setActivity((items) => [`${action}: ${selected.data.label}`, ...items].slice(0, 5));
  };

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
              <button onClick={() => recordAction('Run staged')} className="flex items-center justify-center gap-2 border border-[#34332f] bg-[#11110f] px-3 py-2.5 text-xs font-semibold hover:border-amber-100/30">
                <Play className="h-4 w-4" /> Run
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
