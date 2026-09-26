import React, { useMemo, useState } from 'react';

type NodeKind = 'agent' | 'tool' | 'memory' | 'workflow';

type GraphNode = { id: string; label: string; kind: NodeKind; x: number; y: number };

const KIND_COLOR: Record<NodeKind, string> = {
  agent: 'var(--os-orange)',
  tool: 'var(--os-lime-deep)',
  memory: 'var(--os-chrome-3)',
  workflow: 'var(--os-ink)',
};

const NODES: GraphNode[] = [
  { id: 'hermes', label: 'Hermes', kind: 'workflow', x: 50, y: 50 },
  { id: 'research', label: 'Research agent', kind: 'agent', x: 20, y: 24 },
  { id: 'ops', label: 'Ops agent', kind: 'agent', x: 80, y: 26 },
  { id: 'finance', label: 'Finance agent', kind: 'agent', x: 84, y: 72 },
  { id: 'crm', label: 'CRM tool', kind: 'tool', x: 16, y: 74 },
  { id: 'search', label: 'Web search', kind: 'tool', x: 36, y: 86 },
  { id: 'vector', label: 'Vector memory', kind: 'memory', x: 66, y: 88 },
  { id: 'policy', label: 'Policy store', kind: 'memory', x: 62, y: 14 },
  { id: 'intake', label: 'Intake workflow', kind: 'workflow', x: 8, y: 48 },
  { id: 'report', label: 'Reporting workflow', kind: 'workflow', x: 92, y: 48 },
];

const EDGES: Array<[string, string]> = [
  ['hermes', 'research'],
  ['hermes', 'ops'],
  ['hermes', 'finance'],
  ['hermes', 'policy'],
  ['hermes', 'vector'],
  ['research', 'search'],
  ['ops', 'crm'],
  ['finance', 'report'],
  ['intake', 'hermes'],
  ['crm', 'intake'],
  ['vector', 'finance'],
];

/** Interactive knowledge-graph constellation with animated edges. */
const KnowledgeConstellation: React.FC = () => {
  const [focus, setFocus] = useState<string | null>(null);
  const byId = useMemo(() => Object.fromEntries(NODES.map((node) => [node.id, node])), []);

  const isDim = (id: string) =>
    focus !== null && focus !== id && !EDGES.some(([a, b]) => (a === focus && b === id) || (b === focus && a === id));

  return (
    <div className="os-card relative overflow-hidden p-4 md:p-5" style={{ minHeight: 420 }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Knowledge graph</h3>
          <p className="text-sm text-[color:var(--os-ink-60)]">Agents, tools, memory and workflows, connected.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KIND_COLOR) as NodeKind[]).map((kind) => (
            <span key={kind} className="os-pill os-mono flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]">
              <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[kind] }} />
              {kind}
            </span>
          ))}
        </div>
      </div>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-[320px] w-full" role="img" aria-label="Knowledge graph of agents, tools, memory and workflows">
        {EDGES.map(([a, b]) => {
          const from = byId[a];
          const to = byId[b];
          const active = focus === a || focus === b;
          return (
            <line
              key={`${a}-${b}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={active ? 'var(--os-orange)' : 'rgba(14,14,12,0.22)'}
              strokeWidth={active ? 0.55 : 0.28}
              className="os-flow"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {NODES.map((node) => (
          <g
            key={node.id}
            onMouseEnter={() => setFocus(node.id)}
            onMouseLeave={() => setFocus(null)}
            onFocus={() => setFocus(node.id)}
            onBlur={() => setFocus(null)}
            tabIndex={0}
            role="button"
            aria-label={`${node.label} — ${node.kind}`}
            style={{ cursor: 'pointer', opacity: isDim(node.id) ? 0.25 : 1, transition: 'opacity 200ms ease' }}
          >
            <circle cx={node.x} cy={node.y} r={focus === node.id ? 2.6 : 1.8} fill={KIND_COLOR[node.kind]} />
            <circle cx={node.x} cy={node.y} r={4.6} fill="transparent" stroke="rgba(14,14,12,0.14)" strokeWidth={0.2} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>

      <p className="os-mono text-center text-[11px] uppercase tracking-[0.18em] text-[color:var(--os-ink-40)]">
        {focus ? byId[focus].label : 'Hover or focus a node to trace its connections'}
      </p>
    </div>
  );
};

export default KnowledgeConstellation;
