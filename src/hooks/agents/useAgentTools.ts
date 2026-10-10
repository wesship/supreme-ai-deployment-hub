
import { useCallback } from "react";
import { toast } from "sonner";
import { Tool, Skill } from "@/types/agent";
import { AgentToolsService } from "@/services/agent/toolsService";

/**
 * Hook for agent tools and skills management
 */
export const useAgentTools = (
  stateProps: {
    setAvailableTools: (tools: Tool[]) => void;
    setExtractedSkills: (skills: Skill[]) => void;
    setSkillsLoading: (loading: boolean) => void;
  }
) => {
  const { setAvailableTools, setExtractedSkills, setSkillsLoading } = stateProps;
  
  // Fetch all available tools
  const fetchTools = useCallback(async () => {
    try {
      const response = await AgentToolsService.getAgentTools();
      setAvailableTools(response.tools);
    } catch (error) {
      console.error("Failed to fetch tools:", error);
    }
  }, [setAvailableTools]);
  
  // Fetch agent-specific tools
  const fetchAgentTools = useCallback(async (agentId: string) => {
    try {
      const response = await AgentToolsService.getAgentSpecificTools(agentId);
      return response.tools;
    } catch (error) {
      console.error(`Failed to fetch tools for agent ${agentId}:`, error);
      return [];
    }
  }, []);
  
  // Extract skills from text
  const extractSkills = useCallback(async (text: string) => {
    setSkillsLoading(true);
    try {
      const skills = await AgentToolsService.extractSkills(text);
      setExtractedSkills(skills);
      return skills;
    } catch (error) {
      console.error("Failed to extract skills:", error);
      toast.error("Failed to extract skills");
      return [];
    } finally {
      setSkillsLoading(false);
    }
  }, [setExtractedSkills, setSkillsLoading]);

  return {
    fetchTools,
    fetchAgentTools,
    extractSkills
  };
};
