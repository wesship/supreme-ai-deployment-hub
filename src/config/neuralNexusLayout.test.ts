import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('approved Neural Nexus layout contract', () => {
  const page = fs.readFileSync('src/pages/KnowledgeGraphOS.tsx', 'utf8');

  it('keeps the approved command-center shell landmarks', () => {
    for (const landmark of [
      'Connect Everything. Make It Work.',
      'd3-nexus-left-rail',
      'd3-nexus-right-rail',
      'System status',
      'Recent activity',
      'Bridge opportunities',
      'Execution flow',
      'Top agents',
      'Infrastructure',
      'Cost & usage',
      'Explore',
      'Trace',
      'Run',
      'Connect',
      'Monitor',
      'AI Assist',
    ]) {
      expect(page).toContain(landmark);
    }
  });

  it('keeps the approved major cluster set around Hermes', () => {
    for (const cluster of [
      "label: 'People'",
      "label: 'Knowledge + RAG'",
      "label: 'Models'",
      "label: 'AI Films'",
      "label: 'Agents'",
      "label: 'Tools + MCP'",
      "label: 'HNF Ecosystem'",
      "label: 'Workflow Engine'",
      "label: 'Infrastructure'",
      "label: 'Operations'",
      "label: 'Security + Trust'",
      "label: 'Hermes'",
    ]) {
      expect(page).toContain(cluster);
    }
  });

  it('does not hard-code the old reference success and uptime numbers as live telemetry', () => {
    expect(page).not.toContain('98.7%');
    expect(page).not.toContain('100%');
    expect(page).toContain('not reported');
  });
});
