
import { useState } from "react";
import { Agent, AgentType } from "@/types/agent";
import { Tool } from "@/types/agent";
import { AgentMemory } from "@/types/agent";
import { Skill } from "@/types/agent";

/**
 * Hook for managing agent state
 */
export const useAgentState = () => {
  // Agent list state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsByType, setAgentsByType] = useState<Record<AgentType, Agent[]>>({} as Record<AgentType, Agent[]>);
  
  // Agent selection and operation state
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  
  // Tools and capabilities state
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  
  // Memory state
  const [agentMemories, setAgentMemories] = useState<AgentMemory[]>([]);
  const [memoryLoading, setMemoryLoading] = useState<boolean>(false);
  
  // Skills state
  const [extractedSkills, setExtractedSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState<boolean>(false);
  
  return {
    // Agent state
    agents,
    setAgents,
    agentsByType,
    setAgentsByType,
    loading,
    setLoading,
    generating,
    setGenerating,
    selectedAgent,
    setSelectedAgent,
    lastResponse,
    setLastResponse,
    
    // Tools state
    availableTools,
    setAvailableTools,
    
    // Memory state
    agentMemories,
    setAgentMemories,
    memoryLoading,
    setMemoryLoading,
    
    // Skills state
    extractedSkills,
    setExtractedSkills,
    skillsLoading,
    setSkillsLoading,
  };
};
