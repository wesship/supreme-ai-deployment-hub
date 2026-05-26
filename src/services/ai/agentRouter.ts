/**
 * Devonn.ai Multi-Agent Router — Phase 5
 * LangGraph-style orchestration: directed graph of agents with state passing.
 *
 * Architecture:
 *   User intent → IntentClassifier → AgentGraph → parallel/sequential execution → synthesized response
 *
 * Agent types: orchestrator, researcher, coder, deployer, monitor, analyst
 * Each agent is a node in the graph with typed input/output state.
 */

import { streamChat, ChatMessage, OrchestratorConfig } from './orchestrator';
import { dispatchTool, ToolCall, toOpenAITools } from './toolRouter';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentType = 'orchestrator' | 'researcher' | 'coder' | 'deployer' | 'monitor' | 'analyst';
export type AgentStatus = 'idle' | 'running' | 'done' | 'error' | 'waiting';

export interface AgentNode {
  id: string;
  type: AgentType;
  status: AgentStatus;
  task: string;
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  children?: string[]; // child agent IDs spawned by this agent
}

export interface AgentGraph {
  id: string;
  rootAgentId: string;
  nodes: Record<string, AgentNode>;
  status: 'running' | 'done' | 'error';
  finalAnswer?: string;
  createdAt: number;
}

export interface AgentRouterOptions {
  maxAgents?: number;
  maxDepth?: number;
  onAgentUpdate?: (graph: AgentGraph) => void;
  config?: OrchestratorConfig;
}

// ─── Agent System Prompts ──────────────────────────────────────────────────────

const AGENT_PROMPTS: Record<AgentType, string> = {
  orchestrator: `You are the Orchestrator Agent for Devonn.ai. Your role is to:
1. Analyze the user's request and break it into subtasks
2. Decide which specialist agents to spawn (researcher, coder, deployer, monitor, analyst)
3. Synthesize results from all agents into a coherent final answer
4. Use tools when needed to gather real data
Always respond with a JSON plan: {"subtasks": [{"agent": "type", "task": "description"}], "synthesis_needed": true/false}`,

  researcher: `You are the Research Agent for Devonn.ai. Your role is to:
1. Gather information from documentation, the knowledge base, and available tools
2. Synthesize findings into clear, structured summaries
3. Cite sources and confidence levels
Use the search_documentation and get_deployment_status tools when relevant.`,

  coder: `You are the Code Agent for Devonn.ai. Your role is to:
1. Write, review, and debug code for the platform
2. Generate deployment manifests, Kubernetes configs, and CI/CD workflows
3. Explain code changes and their production impact
Always include error handling and follow the existing TypeScript/Python patterns.`,

  deployer: `You are the Deployment Agent for Devonn.ai. Your role is to:
1. Execute deployment operations via GitHub Actions and Vercel
2. Monitor deployment health and rollback if needed
3. Report deployment status and any issues
Use trigger_github_workflow and get_deployment_status tools.`,

  monitor: `You are the Monitor Agent for Devonn.ai. Your role is to:
1. Check system health metrics, error rates, and performance
2. Identify anomalies and potential issues
3. Recommend remediation actions
Use get_system_metrics and get_deployment_status tools.`,

  analyst: `You are the Analysis Agent for Devonn.ai. Your role is to:
1. Analyze data, logs, and metrics to surface insights
2. Identify patterns, bottlenecks, and optimization opportunities
3. Produce structured reports with actionable recommendations`,
};

// ─── Intent Classifier ────────────────────────────────────────────────────────

export function classifyIntent(message: string): AgentType {
  const lower = message.toLowerCase();

  if (lower.match(/deploy|release|push|build|ci|cd|pipeline|vercel|eks|kubernetes/)) return 'deployer';
  if (lower.match(/error|bug|fix|debug|crash|fail|broken|issue|problem/)) return 'coder';
  if (lower.match(/metric|health|status|monitor|uptime|latency|performance|cpu|memory/)) return 'monitor';
  if (lower.match(/analyze|report|insight|trend|pattern|data|usage|cost|token/)) return 'analyst';
  if (lower.match(/research|find|search|look up|documentation|how does|explain|what is/)) return 'researcher';

  // Complex multi-step requests → orchestrator
  if (lower.match(/and then|after that|first.*then|multiple|several|all of|everything/)) return 'orchestrator';

  return 'researcher'; // default
}

// ─── Single Agent Execution ───────────────────────────────────────────────────

async function runAgent(
  node: AgentNode,
  conversationHistory: ChatMessage[],
  config: OrchestratorConfig,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const systemPrompt = AGENT_PROMPTS[node.type];

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6), // last 3 turns for context
    { role: 'user', content: node.task },
  ];

  let result = '';

  // Use tool-calling for agents that need real data
  const toolEnabledAgents: AgentType[] = ['deployer', 'monitor', 'researcher'];
  const useTools = toolEnabledAgents.includes(node.type);

  if (useTools) {
    // Non-streaming tool-calling round
    const apiKey = config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4.1-mini',
        messages,
        tools: toOpenAITools(),
        tool_choice: 'auto',
        max_tokens: 1024,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const choice = data.choices?.[0];

      // Handle tool calls
      if (choice?.message?.tool_calls?.length) {
        const toolResults = await Promise.all(
          choice.message.tool_calls.map(async (tc: { id: string; function: { name: string; arguments: string } }) => {
            const call: ToolCall = {
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments || '{}'),
            };
            return dispatchTool(call);
          })
        );

        // Second round with tool results
        const messagesWithTools: ChatMessage[] = [
          ...messages,
          { role: 'assistant', content: choice.message.content || '' },
          ...toolResults.map(tr => ({
            role: 'user' as const,
            content: `Tool result for ${tr.name}: ${JSON.stringify(tr.result)}`,
          })),
        ];

        for await (const chunk of streamChat(messagesWithTools, { ...config, useRAG: false })) {
          if (chunk.delta) {
            result += chunk.delta;
            onChunk?.(chunk.delta);
          }
        }
        return result;
      }

      result = choice?.message?.content || '';
      onChunk?.(result);
      return result;
    }
  }

  // Streaming response for non-tool agents
  for await (const chunk of streamChat(messages, { ...config, useRAG: false })) {
    if (chunk.delta) {
      result += chunk.delta;
      onChunk?.(chunk.delta);
    }
  }

  return result;
}

// ─── Orchestrator Agent (multi-agent coordinator) ─────────────────────────────

async function runOrchestratorAgent(
  task: string,
  conversationHistory: ChatMessage[],
  graph: AgentGraph,
  options: AgentRouterOptions
): Promise<string> {
  const apiKey = options.config?.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

  // Get orchestration plan
  const planMessages: ChatMessage[] = [
    { role: 'system', content: AGENT_PROMPTS.orchestrator },
    ...conversationHistory.slice(-4),
    { role: 'user', content: task },
  ];

  const planResp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.config?.model || 'gpt-4.1-mini',
      messages: planMessages,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    }),
  });

  let subtasks: Array<{ agent: AgentType; task: string }> = [];

  if (planResp.ok) {
    const planData = await planResp.json();
    try {
      const plan = JSON.parse(planData.choices?.[0]?.message?.content || '{}');
      subtasks = plan.subtasks || [];
    } catch {
      // Fall back to single researcher agent
      subtasks = [{ agent: 'researcher', task }];
    }
  } else {
    subtasks = [{ agent: 'researcher', task }];
  }

  // Cap at maxAgents
  const maxAgents = options.maxAgents || 3;
  subtasks = subtasks.slice(0, maxAgents);

  // Spawn and run sub-agents
  const subResults: string[] = [];

  for (const subtask of subtasks) {
    const childId = `${subtask.agent}-${Date.now().toString(36)}`;
    const childNode: AgentNode = {
      id: childId,
      type: subtask.agent,
      status: 'running',
      task: subtask.task,
      startedAt: Date.now(),
    };

    graph.nodes[childId] = childNode;
    graph.nodes[graph.rootAgentId].children = [
      ...(graph.nodes[graph.rootAgentId].children || []),
      childId,
    ];
    options.onAgentUpdate?.(graph);

    try {
      const result = await runAgent(childNode, conversationHistory, options.config || {});
      childNode.status = 'done';
      childNode.result = result;
      childNode.completedAt = Date.now();
      subResults.push(`[${subtask.agent.toUpperCase()}]: ${result}`);
    } catch (err) {
      childNode.status = 'error';
      childNode.error = err instanceof Error ? err.message : String(err);
      subResults.push(`[${subtask.agent.toUpperCase()} ERROR]: ${childNode.error}`);
    }

    options.onAgentUpdate?.(graph);
  }

  // Synthesize results
  const synthesisMessages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are synthesizing results from multiple specialist agents. Combine their findings into a single, coherent, well-structured response for the user. Be concise and actionable.',
    },
    { role: 'user', content: `Original request: ${task}\n\nAgent results:\n${subResults.join('\n\n')}` },
  ];

  let synthesis = '';
  for await (const chunk of streamChat(synthesisMessages, { ...options.config, useRAG: false })) {
    if (chunk.delta) synthesis += chunk.delta;
  }

  return synthesis || subResults.join('\n\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Route a user message through the agent graph.
 * Returns an async generator of text chunks for streaming display.
 */
export async function* routeToAgents(
  message: string,
  conversationHistory: ChatMessage[],
  options: AgentRouterOptions = {}
): AsyncGenerator<{ chunk: string; graph: AgentGraph }> {
  const graphId = `graph-${Date.now().toString(36)}`;
  const rootId = `orchestrator-${Date.now().toString(36)}`;
  const intent = classifyIntent(message);

  const graph: AgentGraph = {
    id: graphId,
    rootAgentId: rootId,
    nodes: {
      [rootId]: {
        id: rootId,
        type: intent === 'orchestrator' ? 'orchestrator' : intent,
        status: 'running',
        task: message,
        startedAt: Date.now(),
      },
    },
    status: 'running',
    createdAt: Date.now(),
  };

  options.onAgentUpdate?.(graph);

  try {
    let result: string;

    if (intent === 'orchestrator') {
      // Multi-agent: orchestrator spawns sub-agents
      result = await runOrchestratorAgent(message, conversationHistory, graph, options);
    } else {
      // Single agent: run directly with streaming
      const rootNode = graph.nodes[rootId];
      result = '';
      for await (const chunk of streamChat(
        [
          { role: 'system', content: AGENT_PROMPTS[intent] },
          ...conversationHistory.slice(-6),
          { role: 'user', content: message },
        ],
        { ...options.config, useRAG: true }
      )) {
        if (chunk.delta) {
          result += chunk.delta;
          yield { chunk: chunk.delta, graph };
        }
      }
      rootNode.result = result;
      rootNode.status = 'done';
      rootNode.completedAt = Date.now();
      graph.status = 'done';
      graph.finalAnswer = result;
      options.onAgentUpdate?.(graph);
      return;
    }

    graph.nodes[rootId].status = 'done';
    graph.nodes[rootId].result = result;
    graph.nodes[rootId].completedAt = Date.now();
    graph.status = 'done';
    graph.finalAnswer = result;
    options.onAgentUpdate?.(graph);

    // Stream the synthesized result
    for (const char of result) {
      yield { chunk: char, graph };
    }
  } catch (err) {
    graph.nodes[rootId].status = 'error';
    graph.nodes[rootId].error = err instanceof Error ? err.message : String(err);
    graph.status = 'error';
    options.onAgentUpdate?.(graph);
    yield { chunk: `\n\n[Agent error: ${graph.nodes[rootId].error}]`, graph };
  }
}

/**
 * Check if a message should be routed through the agent graph
 * (vs. direct LLM call for simple conversational messages).
 */
export function shouldUseAgentMode(message: string): boolean {
  const lower = message.toLowerCase();
  // Trigger agent mode for action-oriented, multi-step, or operational requests
  return !!(lower.match(
    /deploy|trigger|run|execute|spawn|check|monitor|analyze|build|create|fix|debug|scale|rollback|workflow|agent|status|metric/
  ));
}
