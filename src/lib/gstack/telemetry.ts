export interface AgentRunRecord {
 id: string;
 agent: string;
 objective: string;
 status: 'started' | 'completed' | 'blocked';
 timestamp: string;
 evidence?: string;
}

const agentRunLedger: AgentRunRecord[] = [];

export function recordAgentRun(run: AgentRunRecord): void {
 agentRunLedger.push(run);
}

export function getAgentRunLedger(): readonly AgentRunRecord[] {
 return [...agentRunLedger];
}

export function summarizeAgentRuns(): Record<string, number> {
 return agentRunLedger.reduce<Record<string, number>>((acc, run) => {
  acc[run.agent] = (acc[run.agent] ?? 0) + 1;
  return acc;
 }, {});
}
