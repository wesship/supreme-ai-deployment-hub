
import { useEffect } from "react";
import { useAgentState } from "./useAgentState";
import { useAgentOperations } from "./useAgentOperations";
import { useAgentMemory } from "./useAgentMemory";
import { useAgentTools } from "./useAgentTools";

/**
 * Main hook that combines all agent-related functionality
 */
export const useAgents = () => {
  // Get all the state variables and setters from our state hook
  const agentState = useAgentState();
  
  // Initialize the operation hooks with the state
  const agentOperations = useAgentOperations({
    setAgents: agentState.setAgents,
    setAgentsByType: agentState.setAgentsByType,
    setLoading: agentState.setLoading,
    setGenerating: agentState.setGenerating,
    setLastResponse: agentState.setLastResponse,
    selectedAgent: agentState.selectedAgent
  });
  
  const agentMemory = useAgentMemory({
    setAgentMemories: agentState.setAgentMemories,
    setMemoryLoading: agentState.setMemoryLoading
  });
  
  const agentTools = useAgentTools({
    setAvailableTools: agentState.setAvailableTools,
    setExtractedSkills: agentState.setExtractedSkills,
    setSkillsLoading: agentState.setSkillsLoading
  });

  // Fetch agents and tools on component mount
  useEffect(() => {
    agentOperations.fetchAgents();
    agentTools.fetchTools();
  }, [agentOperations.fetchAgents, agentTools.fetchTools]);

  // Return everything combined
  return {
    // State
    ...agentState,
    
    // Agent operations
    ...agentOperations,
    
    // Memory operations
    ...agentMemory,
    
    // Tools operations
    ...agentTools
  };
};
