import { useState, useCallback, useRef } from "react";
import {
  AutonomousAgentExecutor,
  type AgentRunConfig,
  type AgentRun,
  type AgentStep,
} from "@/lib/mcp";

export interface UseAutonomousAgentReturn {
  // State
  run: AgentRun | null;
  isRunning: boolean;
  steps: AgentStep[];
  status: AgentRun["status"] | null;
  error: string | null;

  // Actions
  startAgent: (config: AgentRunConfig) => Promise<AgentRun>;
  stopAgent: () => void;
  clearRun: () => void;
}

/**
 * React hook for running autonomous MCP agents
 *
 * @example
 * ```tsx
 * const { startAgent, steps, isRunning, stopAgent } = useAutonomousAgent();
 *
 * await startAgent({
 *   agentId: "agent-1",
 *   name: "Research Agent",
 *   goal: "Search for information about MCP protocol",
 *   mcpGatewayUrl: "http://localhost:8080/mcp",
 * });
 * ```
 */
export function useAutonomousAgent(): UseAutonomousAgentReturn {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [status, setStatus] = useState<AgentRun["status"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executorRef = useRef<AutonomousAgentExecutor | null>(null);

  const startAgent = useCallback(async (config: AgentRunConfig): Promise<AgentRun> => {
    setIsRunning(true);
    setSteps([]);
    setError(null);
    setStatus("idle");

    const executor = new AutonomousAgentExecutor(config, {
      onStep: (step) => {
        setSteps((prev) => [...prev, step]);
      },
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
    });

    executorRef.current = executor;

    try {
      const result = await executor.execute();
      setRun(result);

      if (result.error) {
        setError(result.error);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Agent execution failed";
      setError(message);
      throw err;
    } finally {
      setIsRunning(false);
      executorRef.current = null;
    }
  }, []);

  const stopAgent = useCallback(() => {
    if (executorRef.current) {
      executorRef.current.stop();
    }
  }, []);

  const clearRun = useCallback(() => {
    setRun(null);
    setSteps([]);
    setStatus(null);
    setError(null);
  }, []);

  return {
    run,
    isRunning,
    steps,
    status,
    error,
    startAgent,
    stopAgent,
    clearRun,
  };
}
