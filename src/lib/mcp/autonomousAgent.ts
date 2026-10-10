import type { McpTool, McpToolResult } from "./types";
import type { AgentRunConfig, AgentRun, AgentStep } from "./agentTypes";
import { McpClient } from "./client";

type StepCallback = (step: AgentStep) => void;
type StatusCallback = (status: AgentRun["status"]) => void;

/**
 * Autonomous Agent Executor
 * 
 * Uses ReAct pattern (Reasoning + Acting) to accomplish goals
 * by iteratively thinking and calling MCP tools.
 */
export class AutonomousAgentExecutor {
  private mcpClient: McpClient | null = null;
  private availableTools: McpTool[] = [];
  private run: AgentRun;
  private onStep?: StepCallback;
  private onStatusChange?: StatusCallback;
  private shouldStop = false;

  constructor(
    config: AgentRunConfig,
    callbacks?: {
      onStep?: StepCallback;
      onStatusChange?: StatusCallback;
    }
  ) {
    this.run = {
      id: `run-${Date.now()}`,
      agentId: config.agentId,
      config,
      status: "idle",
      steps: [],
      startedAt: new Date().toISOString(),
    };
    this.onStep = callbacks?.onStep;
    this.onStatusChange = callbacks?.onStatusChange;
  }

  private updateStatus(status: AgentRun["status"]) {
    this.run.status = status;
    this.onStatusChange?.(status);
  }

  private addStep(step: Omit<AgentStep, "id" | "timestamp">): AgentStep {
    const fullStep: AgentStep = {
      ...step,
      id: `step-${this.run.steps.length + 1}`,
      timestamp: new Date().toISOString(),
    };
    this.run.steps.push(fullStep);
    this.onStep?.(fullStep);
    console.log(`[Agent] ${step.type}:`, step.content);
    return fullStep;
  }

  private isToolAllowed(name: string): boolean {
    const configuredTools = this.run.config.mcpTools;

    // An explicit allow-list is always authoritative, including an empty list.
    if (Array.isArray(configuredTools)) {
      return configuredTools.includes(name);
    }

    // Full gateway access requires a separate, explicit opt-in.
    return this.run.config.allowAllMcpTools === true;
  }

  /**
   * Connect to MCP Gateway and initialize tools
   */
  async initialize(): Promise<void> {
    console.log("[Agent] Initializing with gateway:", this.run.config.mcpGatewayUrl);
    
    this.mcpClient = new McpClient({
      gatewayUrl: this.run.config.mcpGatewayUrl,
      timeout: 60000,
    });

    await this.mcpClient.initialize();
    const gatewayTools = await this.mcpClient.listTools();
    this.availableTools = gatewayTools.filter((tool) => this.isToolAllowed(tool.name));

    console.log("[Agent] Available tools:", this.availableTools.map((t) => t.name));
  }

  /**
   * Execute the agent's goal using ReAct pattern
   */
  async execute(): Promise<AgentRun> {
    try {
      await this.initialize();
      this.updateStatus("thinking");

      const maxSteps = this.run.config.maxSteps ?? 10;
      let iteration = 0;

      // Initial thought
      this.addStep({
        type: "thought",
        content: `Starting task: "${this.run.config.goal}". I have access to ${this.availableTools.length} tools: ${this.availableTools.map((t) => t.name).join(", ")}`,
      });

      while (iteration < maxSteps && !this.shouldStop) {
        iteration++;

        // Decide next action using simple heuristic (in production, use LLM)
        const nextAction = await this.decideNextAction();

        if (nextAction.type === "final_answer") {
          this.addStep({
            type: "final_answer",
            content: nextAction.content,
          });
          this.run.finalResult = nextAction.content;
          break;
        }

        if (nextAction.type === "tool_call" && nextAction.toolName) {
          // Execute tool
          this.updateStatus("executing");
          
          this.addStep({
            type: "tool_call",
            content: `Calling tool: ${nextAction.toolName}`,
            toolName: nextAction.toolName,
            toolArgs: nextAction.toolArgs,
          });

          try {
            const result = await this.callTool(nextAction.toolName, nextAction.toolArgs ?? {});
            
            const resultText = result.content
              .map((c) => c.text ?? JSON.stringify(c))
              .join("\n");

            this.addStep({
              type: "tool_result",
              content: resultText.slice(0, 2000), // Truncate long results
              toolName: nextAction.toolName,
            });

            // Observe and think
            this.updateStatus("thinking");
            this.addStep({
              type: "observation",
              content: `Tool ${nextAction.toolName} returned ${result.isError ? "an error" : "successfully"}. ${result.isError ? "I should try a different approach." : "I can use this information."}`,
            });
          } catch (error) {
            this.addStep({
              type: "tool_result",
              content: `Error: ${error instanceof Error ? error.message : "Tool call failed"}`,
              toolName: nextAction.toolName,
            });
          }
        }
      }

      if (this.shouldStop) {
        this.run.error = "Agent was stopped by user";
        this.updateStatus("stopped");
      } else if (iteration >= maxSteps && !this.run.finalResult) {
        this.run.error = "Max steps reached without completing goal";
        this.updateStatus("failed");
      } else {
        this.updateStatus("completed");
      }
    } catch (error) {
      this.run.error = error instanceof Error ? error.message : "Unknown error";
      this.updateStatus("failed");
    } finally {
      this.run.completedAt = new Date().toISOString();
      await this.mcpClient?.close();
    }

    return this.run;
  }

  /**
   * Decide next action - in production, this would call an LLM
   * For demo, uses pattern matching on goal
   */
  private async decideNextAction(): Promise<{
    type: "tool_call" | "final_answer";
    content: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
  }> {
    const goal = this.run.config.goal.toLowerCase();
    const stepCount = this.run.steps.length;

    // Check if we have tool results to analyze
    const lastToolResult = [...this.run.steps].reverse().find((s) => s.type === "tool_result");

    if (lastToolResult && stepCount > 3) {
      // We have results, provide final answer
      return {
        type: "final_answer",
        content: `Based on my analysis: ${lastToolResult.content.slice(0, 500)}`,
      };
    }

    // Determine which tool to use based on goal keywords
    if (goal.includes("search") || goal.includes("find") || goal.includes("look up")) {
      const searchTool = this.availableTools.find((t) =>
        ["duckduckgo_search", "web_search", "search"].includes(t.name)
      );
      if (searchTool) {
        // Extract search query from goal
        const query = this.run.config.goal.replace(/search for|find|look up/gi, "").trim();
        return {
          type: "tool_call",
          content: `Searching for: ${query}`,
          toolName: searchTool.name,
          toolArgs: { query },
        };
      }
    }

    if (goal.includes("file") || goal.includes("read") || goal.includes("list")) {
      const fileTool = this.availableTools.find((t) =>
        ["read_file", "list_directory", "filesystem_read"].includes(t.name)
      );
      if (fileTool) {
        return {
          type: "tool_call",
          content: `Accessing filesystem`,
          toolName: fileTool.name,
          toolArgs: { path: "." },
        };
      }
    }

    if (goal.includes("github") || goal.includes("repo")) {
      const githubTool = this.availableTools.find((t) =>
        t.name.includes("github")
      );
      if (githubTool) {
        return {
          type: "tool_call",
          content: `Accessing GitHub`,
          toolName: githubTool.name,
          toolArgs: {},
        };
      }
    }

    // Default: use first available tool or provide answer
    if (this.availableTools.length > 0 && stepCount < 2) {
      const tool = this.availableTools[0];
      return {
        type: "tool_call",
        content: `Trying ${tool.name}`,
        toolName: tool.name,
        toolArgs: {},
      };
    }

    return {
      type: "final_answer",
      content: `I analyzed the goal "${this.run.config.goal}" but could not find the right tools to complete it. Available tools: ${this.availableTools.map((t) => t.name).join(", ")}`,
    };
  }

  private async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    if (!this.mcpClient) {
      throw new Error("MCP client not initialized");
    }
    if (!this.isToolAllowed(name)) {
      throw new Error(`MCP tool not permitted: ${name}`);
    }
    return this.mcpClient.callTool(name, args);
  }

  /**
   * Stop the agent execution
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Get current run state
   */
  getRun(): AgentRun {
    return { ...this.run };
  }
}

/**
 * Create and execute an autonomous agent
 */
export async function runAutonomousAgent(
  config: AgentRunConfig,
  callbacks?: {
    onStep?: StepCallback;
    onStatusChange?: StatusCallback;
  }
): Promise<AgentRun> {
  const executor = new AutonomousAgentExecutor(config, callbacks);
  return executor.execute();
}
