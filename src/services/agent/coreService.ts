import {
  Task,
  Agent,
  AgentResponse,
  AgentsListResponse,
  AgentType,
} from '@/types/agent';
import { supabase } from '@/integrations/supabase/client';
import { apiClient, handleServiceError } from '../config';
import { normalizeAgentsResponse } from './normalizeAgents';

const AGENT_LIST_ENDPOINTS = [
  '/api/agents/',
  '/api/agents/agents/',
  '/agents',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function listAgentsFromApi(): Promise<AgentsListResponse> {
  let lastError: unknown = new Error('No agent API endpoint responded');
  let emptyResponse: AgentsListResponse | null = null;

  for (const endpoint of AGENT_LIST_ENDPOINTS) {
    try {
      const response = await apiClient.get(endpoint);
      const normalized = normalizeAgentsResponse(response.data);
      if (normalized.agents.length > 0) return normalized;
      emptyResponse = normalized;
    } catch (error) {
      lastError = error;
    }
  }

  if (emptyResponse) return emptyResponse;
  throw lastError;
}

async function listAgentsFromSupabase(): Promise<AgentsListResponse> {
  const { data, error } = await (supabase as any)
    .from('deployed_agents')
    .select('id,name,status,config')
    .order('deployed_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  const rows = (data ?? []).map((row: any) => {
    const config = isRecord(row.config) ? row.config : {};
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      description:
        typeof config.description === 'string'
          ? config.description
          : `${row.name ?? 'Agent'} is ${row.status ?? 'available'}`,
      type: typeof config.type === 'string' ? config.type : 'custom',
      capabilities: Array.isArray(config.capabilities) ? config.capabilities : undefined,
      tools: Array.isArray(config.tools) ? config.tools : undefined,
      memory_enabled:
        typeof config.memory_enabled === 'boolean' ? config.memory_enabled : undefined,
    };
  });

  return normalizeAgentsResponse(rows);
}

export const AgentCoreService = {
  // Prefer the FastAPI agent mesh, then fall back to the governed Supabase registry.
  listAgents: async (): Promise<AgentsListResponse> => {
    let apiResponse: AgentsListResponse | null = null;
    let apiError: unknown = null;

    try {
      apiResponse = await listAgentsFromApi();
      if (apiResponse.agents.length > 0) return apiResponse;
    } catch (error) {
      apiError = error;
    }

    try {
      const fallback = await listAgentsFromSupabase();
      if (apiError) {
        console.warn('Agent API unavailable; using Supabase agent registry fallback.');
      }
      return fallback;
    } catch (fallbackError) {
      if (apiResponse) return apiResponse;
      console.error('Agent API and Supabase fallback both failed:', {
        apiError,
        fallbackError,
      });
      throw apiError ?? fallbackError;
    }
  },

  // Filtering locally avoids depending on a legacy backend route that is not present in production.
  listAgentsByType: async (type: AgentType): Promise<AgentsListResponse> => {
    try {
      const response = await AgentCoreService.listAgents();
      return {
        agents: response.agents.filter((agent) => (agent.type ?? 'custom') === type),
      };
    } catch (error) {
      return handleServiceError(error, `Error fetching ${type} agents`);
    }
  },

  getAgentDetails: async (agentId: string): Promise<Agent> => {
    try {
      const response = await AgentCoreService.listAgents();
      const agent = response.agents.find((candidate) => candidate.id === agentId);
      if (!agent) throw new Error(`Agent ${agentId} was not found`);
      return agent;
    } catch (error) {
      return handleServiceError(error, `Error fetching agent ${agentId}`);
    }
  },

  generateAgent: async (task: Task): Promise<AgentResponse> => {
    try {
      const response = await apiClient.get('/generate-agent', { params: task });
      return response.data;
    } catch (error) {
      return handleServiceError(error, 'Error generating agent');
    }
  },

  runAgent: async (agentId: string, task: Task): Promise<AgentResponse> => {
    try {
      const response = await apiClient.post(`/run-agent/${agentId}`, task);
      return response.data;
    } catch (error) {
      return handleServiceError(error, `Error running agent ${agentId}`);
    }
  },

  getButtonConfig: async () => {
    try {
      const response = await apiClient.get('/ui/button');
      return response.data;
    } catch (error) {
      return handleServiceError(error, 'Error fetching button config');
    }
  },

  createTypedAgent: async (agent: Omit<Agent, 'id'>): Promise<Agent> => {
    try {
      const response = await apiClient.post('/agents/create', agent);
      return response.data;
    } catch (error) {
      return handleServiceError(error, 'Error creating typed agent');
    }
  },
};
