/**
 * Devonn.ai Agent Console — Phase 3 & 5
 * Displays live agent graph activity during multi-agent execution.
 * Shows agent nodes, status, task, and timing.
 */

import React from 'react';
import { AgentGraph, AgentNode, AgentType } from '../../services/ai/agentRouter';
import { Bot, Zap, Search, Code2, Rocket, Activity, BarChart3, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const AGENT_ICONS: Record<AgentType, React.ReactNode> = {
  orchestrator: <Zap className="w-3 h-3" />,
  researcher: <Search className="w-3 h-3" />,
  coder: <Code2 className="w-3 h-3" />,
  deployer: <Rocket className="w-3 h-3" />,
  monitor: <Activity className="w-3 h-3" />,
  analyst: <BarChart3 className="w-3 h-3" />,
};

const AGENT_COLORS: Record<AgentType, string> = {
  orchestrator: '#7080FF',
  researcher: '#60A5FA',
  coder: '#F59E0B',
  deployer: '#A78BFA',
  monitor: '#34D399',
  analyst: '#F472B6',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  running: <Loader2 className="w-3 h-3 animate-spin" />,
  done: <CheckCircle2 className="w-3 h-3" />,
  error: <XCircle className="w-3 h-3" />,
  idle: <Bot className="w-3 h-3" />,
  waiting: <Loader2 className="w-3 h-3" />,
};

interface AgentNodeCardProps {
  node: AgentNode;
  isRoot?: boolean;
}

const AgentNodeCard: React.FC<AgentNodeCardProps> = ({ node, isRoot }) => {
  const color = AGENT_COLORS[node.type];
  const duration = node.completedAt && node.startedAt
    ? `${((node.completedAt - node.startedAt) / 1000).toFixed(1)}s`
    : null;

  return (
    <div
      style={{
        border: `1px solid ${node.status === 'running' ? color : 'rgba(51,65,85,0.8)'}`,
        background: node.status === 'running'
          ? `rgba(${hexToRgb(color)},0.05)`
          : 'rgba(15,23,42,0.6)',
        padding: '8px 10px',
        marginBottom: '4px',
        transition: 'border-color 0.3s, background 0.3s',
        marginLeft: isRoot ? '0' : '16px',
        borderLeft: !isRoot ? `3px solid ${color}` : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color }}>{AGENT_ICONS[node.type]}</span>
        <span style={{ fontFamily: 'monospace', fontSize: '12px', color, fontWeight: 700, textTransform: 'uppercase' }}>
          {node.type}
        </span>
        <span style={{ color: statusColor(node.status), marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px' }}>
          {STATUS_ICON[node.status]}
          <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>{node.status}</span>
        </span>
        {duration && (
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#475569' }}>{duration}</span>
        )}
      </div>
      <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94A3B8', marginTop: '4px', lineHeight: 1.4 }}>
        {node.task.length > 120 ? node.task.slice(0, 120) + '…' : node.task}
      </p>
      {node.error && (
        <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#EF4444', marginTop: '4px' }}>
          Error: {node.error}
        </p>
      )}
    </div>
  );
};

function statusColor(status: string): string {
  switch (status) {
    case 'running': return '#F59E0B';
    case 'done': return '#7080FF';
    case 'error': return '#EF4444';
    default: return '#475569';
  }
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

interface AgentConsoleProps {
  graph: AgentGraph;
  collapsed?: boolean;
  onToggle?: () => void;
}

export const AgentConsole: React.FC<AgentConsoleProps> = ({ graph, collapsed = false, onToggle }) => {
  const nodes = Object.values(graph.nodes);
  const rootNode = graph.nodes[graph.rootAgentId];
  const childNodes = nodes.filter(n => n.id !== graph.rootAgentId);
  const isMultiAgent = childNodes.length > 0;

  const elapsed = graph.status === 'done' && rootNode?.completedAt
    ? `${((rootNode.completedAt - graph.createdAt) / 1000).toFixed(1)}s`
    : null;

  return (
    <div
      style={{
        background: 'rgba(7,10,15,0.95)',
        border: '1px solid rgba(112,128,255,0.15)',
        marginBottom: '8px',
        fontFamily: 'monospace',
      }}
    >
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          borderBottom: collapsed ? 'none' : '1px solid rgba(51,65,85,0.5)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Zap className="w-3 h-3" style={{ color: '#7080FF' }} />
        <span style={{ fontSize: '11px', color: '#7080FF', fontWeight: 700 }}>
          AGENT {isMultiAgent ? 'MESH' : 'MODE'}
        </span>
        <span style={{ fontSize: '10px', color: '#475569', marginLeft: '4px' }}>
          {nodes.length} agent{nodes.length !== 1 ? 's' : ''}
          {elapsed ? ` · ${elapsed}` : ''}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '10px',
          color: graph.status === 'done' ? '#7080FF' : graph.status === 'error' ? '#EF4444' : '#F59E0B',
          display: 'flex', alignItems: 'center', gap: '3px',
        }}>
          {graph.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
          {graph.status === 'done' && <CheckCircle2 className="w-3 h-3" />}
          {graph.status === 'error' && <XCircle className="w-3 h-3" />}
          {graph.status.toUpperCase()}
        </span>
        <span style={{ color: '#475569', fontSize: '12px', marginLeft: '8px' }}>
          {collapsed ? '▶' : '▼'}
        </span>
      </div>

      {/* Agent nodes */}
      {!collapsed && (
        <div style={{ padding: '8px' }}>
          {rootNode && <AgentNodeCard node={rootNode} isRoot />}
          {childNodes.map(node => (
            <AgentNodeCard key={node.id} node={node} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentConsole;
